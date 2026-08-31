"use client";

import { useState, type FormEvent } from "react";

export interface NativeFormField {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "textarea" | "select" | "checkbox";
  placeholder?: string;
  required?: boolean;
  options?: string;
}

export function NativeForm({
  formKey,
  heading,
  description,
  fields,
  buttonLabel = "Submit",
  successMessage = "Thank you — your response has been received.",
}: {
  formKey: string;
  heading?: string;
  description?: string;
  fields: NativeFormField[];
  buttonLabel?: string;
  successMessage?: string;
}) {
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload: Record<string, string | boolean> = {};
    for (const field of fields) {
      payload[field.name] =
        field.type === "checkbox" ? data.has(field.name) : String(data.get(field.name) ?? "");
    }

    try {
      const response = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formKey,
          fields: payload,
          pagePath: window.location.pathname,
          website: data.get("website"),
        }),
      });
      setState(response.ok ? "done" : "error");
      if (response.ok) form.reset();
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="border-y border-mg-bd/20 py-8 font-grotesk text-lg" role="status">
        {successMessage}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={state === "submitting"}>
      {(heading || description) && (
        <header>
          {heading && <h2 className="font-grotesk text-3xl font-medium">{heading}</h2>}
          {description && <p className="mt-2 max-w-2xl text-mg-fg/70">{description}</p>}
        </header>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => {
          const id = `${formKey}-${field.name}`;
          if (field.type === "checkbox") {
            return (
              <label key={field.name} htmlFor={id} className="flex items-start gap-3 md:col-span-2">
                <input
                  id={id}
                  name={field.name}
                  type="checkbox"
                  required={field.required}
                  className="mt-1"
                />
                <span>{field.label}</span>
              </label>
            );
          }
          const base =
            "mt-2 w-full border border-mg-bd/25 bg-transparent px-3 py-3 outline-none focus:border-mg-accent";
          return (
            <label
              key={field.name}
              htmlFor={id}
              className={field.type === "textarea" ? "md:col-span-2" : undefined}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.type === "textarea" ? (
                <textarea
                  id={id}
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={5}
                  className={base}
                />
              ) : field.type === "select" ? (
                <select
                  id={id}
                  name={field.name}
                  required={field.required}
                  className={base}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {(field.options ?? "")
                    .split(/\r?\n|,/)
                    .map((option) => option.trim())
                    .filter(Boolean)
                    .map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  id={id}
                  name={field.name}
                  type={field.type ?? "text"}
                  placeholder={field.placeholder}
                  required={field.required}
                  className={base}
                />
              )}
            </label>
          );
        })}
      </div>
      <label className="absolute -left-[10000px]" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {state === "error" && (
        <p role="alert" className="text-sm text-mg-accentInk">
          We could not send that response. Please try again.
        </p>
      )}
      <button
        type="submit"
        disabled={state === "submitting"}
        className="bg-mg-fg px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-mg-bg disabled:opacity-50"
      >
        {state === "submitting" ? "Sending…" : buttonLabel}
      </button>
    </form>
  );
}
