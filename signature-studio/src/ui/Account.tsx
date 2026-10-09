/** Sign in, sync status and sign out. Hidden entirely when accounts aren't configured. */
import { useEffect, useRef, useState } from "react";
import { Cloud, CloudOff, LogOut, Mail, RefreshCw, Trash2, UserRound } from "lucide-react";
import { cloudEnabled } from "../cloud";
import { deleteAccount, signInWithEmail, signInWithGoogle, signOut, syncNow, useAccount } from "../cloud/account";
import { toast, ui, useStudio } from "../store/editor";
import { BRAND } from "../brand";
import { Modal } from "./kit";

function ago(t: number | null) {
  if (!t) return "not yet";
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleTimeString(undefined, { timeStyle: "short" });
}

export function AccountButton() {
  const { user, status, lastSynced, error } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  if (!cloudEnabled) return null;
  if (!user)
    return (
      <button className="btn sm primary" onClick={() => ui({ dialog: "account" })} data-testid="sign-in">
        <UserRound size={16} /> Sign in
      </button>
    );
  const icon = status === "error" || status === "offline" ? <CloudOff size={16} /> : <Cloud size={16} />;
  return (
    <div className="menu-wrap" ref={ref}>
      <button
        className={`btn ghost sm sync-${status}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={status === "syncing" ? "Syncing…" : `Synced ${ago(lastSynced)}`}
        data-testid="account-menu"
      >
        {icon} <span className="desktop-only">{user.name || user.email}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-note">
            <strong>{user.email}</strong>
            <span data-testid="sync-status">
              {status === "syncing"
                ? "Syncing…"
                : status === "error"
                  ? `Sync problem: ${error}`
                  : status === "offline"
                    ? "Offline — will sync when you reconnect"
                    : `Synced ${ago(lastSynced)}`}
            </span>
          </div>
          <button role="menuitem" onClick={() => void syncNow()} data-testid="sync-now">
            <RefreshCw size={16} /> Sync now
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            data-testid="sign-out"
          >
            <LogOut size={16} /> Sign out
          </button>
          <button
            role="menuitem"
            className="danger"
            onClick={() => {
              setOpen(false);
              ui({ dialog: "deleteAccount" });
            }}
            data-testid="delete-account"
          >
            <Trash2 size={16} /> Delete account…
          </button>
        </div>
      )}
    </div>
  );
}

export function AccountDialog() {
  const open = useStudio((s) => s.dialog === "account");
  const user = useAccount((s) => s.user);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setSent(false);
  }, [open]);
  useEffect(() => {
    if (open && user) ui({ dialog: null });
  }, [open, user]);
  if (!cloudEnabled) return null;
  const close = () => ui({ dialog: null });
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't sign in.", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={`Sign in to ${BRAND.name}`}
      subtitle="Keep your signatures, brand kit and images in sync across devices. Everything already on this device comes with you."
      testId="account-dialog"
    >
      {sent ? (
        <p className="lede" data-testid="link-sent">
          Check <strong>{email}</strong> — we've sent a sign-in link. Open it on this device.
        </p>
      ) : (
        <div className="stack" style={{ display: "grid", gap: 12 }}>
          <button className="btn" disabled={busy} onClick={() => void run(signInWithGoogle)} data-testid="sign-in-google">
            Continue with Google
          </button>
          <div className="or">or</div>
          <form
            className="row"
            style={{ gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast("Enter your email address", "info");
              void run(async () => {
                await signInWithEmail(email);
                setSent(true);
              });
            }}
          >
            <input
              className="input grow"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
              data-testid="sign-in-email"
            />
            <button className="btn primary" type="submit" disabled={busy} data-testid="sign-in-send">
              <Mail size={15} /> Email me a link
            </button>
          </form>
          <p className="hint">No password needed. We only use your email to sign you in.</p>
        </div>
      )}
    </Modal>
  );
}

export function DeleteAccountDialog() {
  const open = useStudio((s) => s.dialog === "deleteAccount");
  const email = useAccount((s) => s.user?.email ?? "");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  if (!cloudEnabled) return null;
  const close = () => ui({ dialog: null });
  const go = async () => {
    setBusy(true);
    try {
      await deleteAccount();
      close();
    } catch (e) {
      toast(`Couldn't delete the account: ${e instanceof Error ? e.message : e}`, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Delete your account?"
      subtitle="This permanently removes your account, the signatures and images stored in it, and your short card links. Images in emails you've already sent will stop showing."
      testId="delete-account-dialog"
      footer={
        <>
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button
            className="btn danger"
            disabled={busy || typed.trim().toLowerCase() !== email.toLowerCase()}
            onClick={() => void go()}
            data-testid="delete-account-confirm"
          >
            Delete account
          </button>
        </>
      }
    >
      <p className="hint">Signatures on this device stay here. Type your email to confirm.</p>
      <input
        className="input"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={email}
        aria-label="Confirm email"
        data-testid="delete-account-email"
      />
    </Modal>
  );
}
