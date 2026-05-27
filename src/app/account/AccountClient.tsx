"use client";

import { useEffect, useRef, useState } from "react";
import {
  RecaptchaVerifier,
  linkWithPhoneNumber,
  unlink,
  updateProfile,
  sendEmailVerification,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type ConfirmationResult,
} from "firebase/auth";
import {
  CheckBadgeIcon,
  EnvelopeIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { useAuth, getAppAuth } from "@/lib/auth";
import {
  updateDisplayName,
  syncPhoneNumber,
  regenerateAvatar,
} from "@/lib/profile";
import { PageHeader } from "@/components/PageHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { ClientDate } from "@/components/ClientDate";
import {
  FormCard,
  FormField,
  SubmitButton,
  inputCls,
} from "@/components/FormCard";

type ToastFn = (text: string, kind?: "success" | "error" | "info") => void;

function useToast(): [
  { text: string; kind: "success" | "error" | "info" } | null,
  ToastFn,
] {
  const [t, setT] = useState<{
    text: string;
    kind: "success" | "error" | "info";
  } | null>(null);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), 4000);
    return () => clearTimeout(id);
  }, [t]);
  return [t, (text, kind = "success") => setT({ text, kind })];
}

export function AccountClient() {
  const { user, profile, refresh } = useAuth();
  const [toast, addToast] = useToast();

  // ── Personal Info ───────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(profile?.displayName || user?.displayName || "");
  }, [profile?.displayName, user?.displayName]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user, { displayName: name });
      await updateDisplayName(user.uid, name);
      await refresh();
      addToast("Display name updated successfully.", "success");
    } catch (err) {
      addToast((err as Error).message || "Failed to update name.", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Password ────────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(undefined);
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (!user || !user.email) return;
    setSavingPassword(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      addToast("Password changed successfully.", "success");
    } catch (err) {
      const code = (err as { code?: string }).code;
      const map: Record<string, string> = {
        "auth/wrong-password": "Current password is incorrect.",
        "auth/invalid-credential": "Current password is incorrect.",
        "auth/weak-password":
          "New password is too weak. Use at least 8 characters.",
        "auth/requires-recent-login":
          "Please sign out and back in, then try again.",
      };
      setPasswordError(map[code || ""] || (err as Error).message);
    } finally {
      setSavingPassword(false);
    }
  }

  // ── Phone ───────────────────────────────────────────────────────────────
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneStage, setPhoneStage] = useState<"idle" | "sent">("idle");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const confirmRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainer = useRef<HTMLDivElement>(null);

  function ensureVerifier() {
    if (verifierRef.current) return verifierRef.current;
    verifierRef.current = new RecaptchaVerifier(
      getAppAuth(),
      recaptchaContainer.current!,
      { size: "invisible" },
    );
    return verifierRef.current;
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setPhoneError(undefined);
    setPhoneBusy(true);
    try {
      const confirm = await linkWithPhoneNumber(
        user,
        phone.trim(),
        ensureVerifier(),
      );
      confirmRef.current = confirm;
      setPhoneStage("sent");
      addToast("Code sent. Enter the 6-digit code below.", "info");
    } catch (err) {
      const c = (err as { code?: string }).code;
      const map: Record<string, string> = {
        "auth/invalid-phone-number":
          "Invalid phone number. Use E.164 format like +14155551234.",
        "auth/too-many-requests": "Too many requests — try again later.",
        "auth/credential-already-in-use":
          "That number is already linked to another account.",
        "auth/provider-already-linked":
          "A phone number is already linked. Remove it first.",
      };
      setPhoneError(map[c || ""] || (err as Error).message);
      try {
        verifierRef.current?.clear();
      } catch {}
      verifierRef.current = null;
    } finally {
      setPhoneBusy(false);
    }
  }

  async function handleConfirmCode(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmRef.current || !user) return;
    setPhoneError(undefined);
    setPhoneBusy(true);
    try {
      const cred = await confirmRef.current.confirm(code.trim());
      const newPhone = cred.user.phoneNumber || phone.trim();
      await syncPhoneNumber(user.uid, newPhone);
      await refresh();
      setPhoneStage("idle");
      setPhone("");
      setCode("");
      addToast("Phone number verified.", "success");
    } catch (err) {
      const c = (err as { code?: string }).code;
      const map: Record<string, string> = {
        "auth/invalid-verification-code": "Incorrect code. Try again.",
        "auth/code-expired": "Code expired. Request a new one.",
      };
      setPhoneError(map[c || ""] || (err as Error).message);
    } finally {
      setPhoneBusy(false);
    }
  }

  async function handleRemovePhone() {
    if (!user) return;
    setPhoneBusy(true);
    try {
      await unlink(user, "phone");
      await syncPhoneNumber(user.uid, null);
      await refresh();
      addToast("Phone number removed.", "success");
    } catch (err) {
      addToast((err as Error).message, "error");
    } finally {
      setPhoneBusy(false);
    }
  }

  // ── Email verification ──────────────────────────────────────────────────
  const [emailSending, setEmailSending] = useState(false);
  async function handleResendEmail() {
    if (!user) return;
    setEmailSending(true);
    try {
      await sendEmailVerification(user);
      addToast("Verification email sent. Check your inbox.", "success");
    } catch (err) {
      addToast((err as Error).message, "error");
    } finally {
      setEmailSending(false);
    }
  }

  // ── Avatar regenerate ───────────────────────────────────────────────────
  const [avatarBusy, setAvatarBusy] = useState(false);
  async function handleRegenerateAvatar() {
    if (!user) return;
    setAvatarBusy(true);
    try {
      const url = await regenerateAvatar(user.uid);
      if (url) {
        addToast("Avatar updated.", "success");
        await refresh();
      } else {
        addToast("Couldn't regenerate avatar. Check Storage rules.", "error");
      }
    } finally {
      setAvatarBusy(false);
    }
  }

  if (!user) return null;

  const linkedPhone = user.phoneNumber || profile?.phoneNumber || null;
  const createdAt = user.metadata.creationTime;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="My Profile"
        description="Manage your account details and security credentials."
      />

      {/* Profile Header Card — gradient banner + avatar */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl mb-6 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#2BB673]/20 to-[#2BB673]/5"></div>
        <div className="px-4 pb-6 sm:px-8 sm:pb-8">
          <div className="relative -mt-12 flex items-start gap-x-5">
            <div className="size-24 rounded-2xl bg-white p-1 shadow-md ring-1 ring-gray-900/5 shrink-0 relative group">
              <UserAvatar
                id={user.uid}
                src={profile?.avatarUrl}
                name={name}
                email={user.email}
                size="xl"
                className="rounded-xl shadow-inner"
              />
              <button
                type="button"
                onClick={handleRegenerateAvatar}
                disabled={avatarBusy}
                title="Regenerate avatar"
                className="absolute -bottom-1 -right-1 size-7 rounded-full bg-white ring-1 ring-gray-900/10 shadow grid place-items-center text-gray-500 hover:text-[#2BB673] hover:ring-[#2BB673]/30 active:scale-95 transition disabled:opacity-50"
              >
                <ArrowPathIcon
                  className={`size-3.5 ${avatarBusy ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            <div className="flex flex-col h-24 justify-between pt-1">
              <div className="flex items-center gap-2 h-11 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  {name || "User"}
                </h1>
                <span className="inline-flex items-center rounded-md bg-[#2BB673]/10 px-2 py-1 text-xs font-semibold text-[#2BB673] ring-1 ring-inset ring-[#2BB673]/20 capitalize">
                  Owner
                </span>
                {user.emailVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#2BB673]/10 px-2 py-1 text-xs font-semibold text-[#2BB673] ring-1 ring-inset ring-[#2BB673]/20">
                    <CheckBadgeIcon className="size-3.5" />
                    Email verified
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    disabled={emailSending}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100 disabled:opacity-50 transition"
                  >
                    <EnvelopeIcon className="size-3.5" />
                    {emailSending ? "Sending…" : "Verify email"}
                  </button>
                )}
              </div>
              <div className="flex items-center h-12 pt-2">
                <span className="text-sm text-gray-500 font-medium">
                  Member since{" "}
                  {createdAt ? (
                    <ClientDate date={createdAt} format="date" />
                  ) : (
                    "—"
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`mb-6 flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
            toast.kind === "success"
              ? "bg-[#2BB673]/10 text-[#1e8a55] ring-1 ring-[#2BB673]/20"
              : toast.kind === "error"
                ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                : "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Personal Information */}
      <FormCard
        onSubmit={handleSaveName}
        title="Personal Information"
        description="Update your display name and view your registered email address."
        className="mb-6"
        footer={
          <SubmitButton
            loading={saving}
            disabled={
              saving || name.trim() === (profile?.displayName || "").trim()
            }
            label="Save Changes"
            loadingLabel="Saving..."
          />
        }
      >
        <FormField id="name" label="Display Name" span="sm:col-span-3">
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </FormField>

        <FormField id="email" label="Email Address" span="sm:col-span-3">
          <input
            id="email"
            type="email"
            value={user.email ?? ""}
            disabled
            className={`${inputCls} bg-gray-50 text-gray-500 cursor-not-allowed`}
          />
        </FormField>
      </FormCard>

      {/* Change Password */}
      <FormCard
        onSubmit={handleSavePassword}
        title="Change Password"
        description="Update your account password."
        className="mb-6"
        error={passwordError}
        footer={
          <SubmitButton
            loading={savingPassword}
            disabled={
              savingPassword ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            label="Change Password"
            loadingLabel="Changing..."
          />
        }
      >
        <FormField
          id="currentPassword"
          label="Current Password"
          span="sm:col-span-full"
        >
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className={inputCls}
          />
        </FormField>

        <FormField
          id="newPassword"
          label="New Password"
          span="sm:col-span-3"
        >
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className={inputCls}
          />
        </FormField>

        <FormField
          id="confirmPassword"
          label="Confirm New Password"
          span="sm:col-span-3"
        >
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className={inputCls}
          />
        </FormField>
      </FormCard>

      {/* Phone Number */}
      <FormCard
        onSubmit={phoneStage === "idle" ? handleSendCode : handleConfirmCode}
        title="Phone Number"
        description="Link a phone number for additional sign-in security."
        className="mb-6"
        error={phoneError}
        footer={
          linkedPhone ? (
            <button
              type="button"
              onClick={handleRemovePhone}
              disabled={phoneBusy}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-bold text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 disabled:opacity-50 transition-all active:scale-95"
            >
              {phoneBusy ? "Removing…" : "Remove Phone"}
            </button>
          ) : phoneStage === "idle" ? (
            <SubmitButton
              loading={phoneBusy}
              disabled={phoneBusy || !phone.trim()}
              label="Send Code"
              loadingLabel="Sending..."
            />
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPhoneStage("idle");
                  setCode("");
                  setPhoneError(undefined);
                }}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <SubmitButton
                loading={phoneBusy}
                disabled={phoneBusy || !code.trim()}
                label="Verify Code"
                loadingLabel="Verifying..."
              />
            </div>
          )
        }
      >
        {linkedPhone ? (
          <FormField id="linkedPhone" label="Linked Phone Number">
            <div className="flex items-center gap-2">
              <input
                id="linkedPhone"
                type="tel"
                value={linkedPhone}
                disabled
                className={`${inputCls} bg-gray-50 text-gray-500 cursor-not-allowed`}
              />
              <span className="inline-flex items-center gap-1 rounded-md bg-[#2BB673]/10 px-2 py-1 text-xs font-semibold text-[#2BB673] ring-1 ring-inset ring-[#2BB673]/20 shrink-0">
                <CheckBadgeIcon className="size-3.5" />
                Verified
              </span>
            </div>
          </FormField>
        ) : phoneStage === "idle" ? (
          <FormField
            id="phone"
            label="Phone Number"
            span="sm:col-span-full"
            hint="Use international E.164 format including the country code."
          >
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+14155551234"
              className={inputCls}
            />
          </FormField>
        ) : (
          <FormField
            id="code"
            label="Verification Code"
            span="sm:col-span-full"
            hint={`Sent to ${phone}. Didn't get it? Cancel and try again in 30 seconds.`}
          >
            <input
              id="code"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className={`${inputCls} tracking-widest text-center font-bold`}
            />
          </FormField>
        )}
        <div ref={recaptchaContainer} className="sm:col-span-full" />
      </FormCard>

      <p className="text-xs text-gray-400">
        Account created{" "}
        {createdAt ? <ClientDate date={createdAt} format="long-date" /> : "—"}
      </p>
    </div>
  );
}
