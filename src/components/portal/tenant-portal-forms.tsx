"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import {
  createMaintenanceRequestAction,
  createTenantConversationAction,
  replyToConversationAction,
  type TenantPortalActionState,
} from "@/app/portal/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: TenantPortalActionState = { status: "idle" };

function FormFeedback({ state }: { state: TenantPortalActionState }) {
  if (!state.message) return null;

  return (
    <Alert
      variant={state.status === "error" ? "destructive" : "default"}
      aria-live="polite"
    >
      {state.status === "success" ? <CheckCircle2 /> : <AlertCircle />}
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

function FieldError({
  state,
  field,
  id,
}: {
  state: TenantPortalActionState;
  field: string;
  id: string;
}) {
  const message = state.errors?.[field]?.[0];
  return message ? (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

function useResetOnSuccess(state: TenantPortalActionState) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return formRef;
}

export function TenantConversationForm() {
  const [state, action, pending] = useActionState(
    createTenantConversationAction,
    initialState,
  );
  const formRef = useResetOnSuccess(state);

  return (
    <form ref={formRef} action={action} className="grid gap-4" noValidate>
      <FormFeedback state={state} />
      <div className="grid gap-2">
        <Label htmlFor="message-subject">Betreff</Label>
        <Input
          id="message-subject"
          name="subject"
          required
          minLength={3}
          maxLength={240}
          aria-invalid={Boolean(state.errors?.subject)}
          aria-describedby={
            state.errors?.subject ? "message-subject-error" : undefined
          }
        />
        <FieldError
          state={state}
          field="subject"
          id="message-subject-error"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="message-category">Kategorie</Label>
        <Select name="category" defaultValue="general" disabled={pending}>
          <SelectTrigger
            id="message-category"
            aria-invalid={Boolean(state.errors?.category)}
            aria-describedby={
              state.errors?.category ? "message-category-error" : undefined
            }
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">Allgemein</SelectItem>
            <SelectItem value="repair">Reparatur</SelectItem>
            <SelectItem value="damage">Schaden</SelectItem>
            <SelectItem value="utilities">Nebenkosten</SelectItem>
            <SelectItem value="payment">Zahlung</SelectItem>
            <SelectItem value="document">Dokument</SelectItem>
          </SelectContent>
        </Select>
        <FieldError
          state={state}
          field="category"
          id="message-category-error"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="message-body">Nachricht</Label>
        <Textarea
          id="message-body"
          name="body"
          required
          minLength={2}
          maxLength={20_000}
          rows={4}
          aria-invalid={Boolean(state.errors?.body)}
          aria-describedby={
            state.errors?.body ? "message-body-error" : undefined
          }
        />
        <FieldError state={state} field="body" id="message-body-error" />
      </div>
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <MessageSquareText aria-hidden="true" />
        )}
        {pending ? "Wird gesendet …" : "Nachricht senden"}
      </Button>
    </form>
  );
}

export function TenantConversationReplyForm({
  conversationId,
}: {
  conversationId: string;
}) {
  const [state, action, pending] = useActionState(
    replyToConversationAction,
    initialState,
  );
  const formRef = useResetOnSuccess(state);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-2 sm:grid-cols-[1fr_auto]"
      noValidate
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="grid gap-2">
        <Label htmlFor={inputId} className="sr-only">
          Antwort
        </Label>
        <Input
          id={inputId}
          name="body"
          required
          minLength={2}
          maxLength={20_000}
          placeholder="Antwort schreiben …"
          aria-invalid={Boolean(state.errors?.body)}
          aria-describedby={state.errors?.body ? errorId : undefined}
        />
        <FieldError state={state} field="body" id={errorId} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {pending ? "Wird gesendet …" : "Senden"}
      </Button>
      <div className="sm:col-span-2">
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

export function TenantMaintenanceRequestForm() {
  const [state, action, pending] = useActionState(
    createMaintenanceRequestAction,
    initialState,
  );
  const formRef = useResetOnSuccess(state);

  return (
    <form ref={formRef} action={action} className="grid gap-4" noValidate>
      <FormFeedback state={state} />
      <div className="grid gap-2">
        <Label htmlFor="request-title">Titel</Label>
        <Input
          id="request-title"
          name="title"
          required
          minLength={3}
          maxLength={240}
          aria-invalid={Boolean(state.errors?.title)}
          aria-describedby={
            state.errors?.title ? "request-title-error" : undefined
          }
        />
        <FieldError state={state} field="title" id="request-title-error" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="request-category">Kategorie</Label>
        <Select name="category" defaultValue="repair" disabled={pending}>
          <SelectTrigger
            id="request-category"
            aria-invalid={Boolean(state.errors?.category)}
            aria-describedby={
              state.errors?.category ? "request-category-error" : undefined
            }
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="repair">Reparatur</SelectItem>
            <SelectItem value="damage">Schaden</SelectItem>
            <SelectItem value="heating">Heizung</SelectItem>
            <SelectItem value="water">Wasser</SelectItem>
            <SelectItem value="electrical">Elektrik</SelectItem>
            <SelectItem value="security">Sicherheit</SelectItem>
            <SelectItem value="other">Sonstiges</SelectItem>
          </SelectContent>
        </Select>
        <FieldError
          state={state}
          field="category"
          id="request-category-error"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="request-description">Beschreibung</Label>
        <Textarea
          id="request-description"
          name="description"
          required
          minLength={5}
          maxLength={20_000}
          rows={5}
          aria-invalid={Boolean(state.errors?.description)}
          aria-describedby={
            state.errors?.description ? "request-description-error" : undefined
          }
        />
        <FieldError
          state={state}
          field="description"
          id="request-description-error"
        />
      </div>
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {pending ? "Wird gesendet …" : "Anliegen absenden"}
      </Button>
    </form>
  );
}
