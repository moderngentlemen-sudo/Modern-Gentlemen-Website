"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/admin/ui/Button";
import { TextInput } from "@/components/admin/ui/Input";
import { Panel, PanelSection } from "@/components/admin/ui/Panel";
import { useToast } from "@/components/admin/ui/Toast";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/domain/passwords";

import { changePasswordAction } from "./actions";

export interface PasswordFormProps {
  /**
   * False only on a recovery landing, where the user cannot supply a password
   * they came here because they do not know. The server decides this again —
   * see the note on the page — so this prop shapes the form and nothing else.
   */
  requireCurrent: boolean;
}

export function PasswordForm({ requireCurrent }: PasswordFormProps) {
  const toast = useToast();
  const [saving, startSaving] = useTransition();

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string>();

  // The same rules the action enforces, imported rather than restated —
  // `lib/domain` is pure, so a client component may hold the vocabulary. This is
  // the fast feedback loop; the action is the one that decides.
  const problem = password || confirmation ? passwordProblem(password, confirmation) : null;

  function submit() {
    setError(undefined);
    startSaving(async () => {
      const result = await changePasswordAction({
        password,
        confirmation,
        // Sent only when the form asked for it. An empty string would be a
        // wrong password rather than an absent one, and the action's messages
        // separate those two.
        ...(requireCurrent ? { currentPassword } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCurrentPassword("");
      setPassword("");
      setConfirmation("");
      toast.push("Password updated", "success");
    });
  }

  return (
    <Panel>
      <PanelSection title="Change password">
        <div className="max-w-[440px] space-y-4">
          <p className="text-[13px] leading-relaxed text-mg-fg/60">
            {requireCurrent
              ? "Applies to your own account. Confirm the password you use now, then choose a new one."
              : "You arrived from a reset link, so there is no current password to confirm — choose a new one and you will not need another link next time."}
          </p>

          {requireCurrent && (
            <TextInput
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              required
            />
          )}

          <TextInput
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
            help={`At least ${MIN_PASSWORD_LENGTH} characters, and under ${MAX_PASSWORD_BYTES} bytes — anything past that is silently ignored by the hash.`}
            required
          />
          <TextInput
            label="Confirm new password"
            type="password"
            value={confirmation}
            onChange={setConfirmation}
            required
          />

          {/* Inline guidance while typing; `error` is what the server said. */}
          {problem && !error && <p className="text-[12px] text-mg-fg/60">{problem}</p>}

          {error && (
            <p role="alert" className="text-[12px] text-mg-accentSerif">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              variant="solid"
              onClick={submit}
              loading={saving}
              disabled={
                problem !== null || password === "" || (requireCurrent && currentPassword === "")
              }
            >
              Update password
            </Button>
          </div>
        </div>
      </PanelSection>
    </Panel>
  );
}
