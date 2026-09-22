import {
  Check,
  Clipboard,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  createPublicShare,
  createRestrictedShare,
  lookupShareRecipient,
  updateShareLink,
} from "../../api/shareLinkApi";
import { getErrorMessage } from "../../lib/error";
import type {
  ShareAccessType,
  ShareDuration,
  ShareLink,
  SharePermission,
  ShareRecipient,
  ShareTarget,
} from "../../types/share-link";
import {
  DAY_DURATIONS,
  HOUR_DURATIONS,
} from "../../types/share-link";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "../ui/radio-group";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import { toast } from "../ui/toast";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target?: ShareTarget | null;
  existingShare?: ShareLink | null;
  onSaved: (share: ShareLink) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 100;

type DurationUnit = "hours" | "days";

const absoluteShareUrl = (url: string) =>
  url.startsWith("http")
    ? url
    : `${window.location.origin}${url}`;

const formatExpiry = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Clipboard is unavailable.");
  }
};

const ShareDialog = ({
  open,
  onOpenChange,
  target,
  existingShare,
  onSaved,
}: ShareDialogProps) => {
  const editing = Boolean(existingShare);

  const [accessType, setAccessType] =
    useState<ShareAccessType>("public");
  const [permission, setPermission] =
    useState<SharePermission>("viewer");
  const [duration, setDuration] =
    useState<ShareDuration>("1d");
  const [durationUnit, setDurationUnit] =
    useState<DurationUnit>("days");
  const [changeExpiration, setChangeExpiration] =
    useState(false);

  const [recipientInput, setRecipientInput] =
    useState("");
  const [selectedRecipients, setSelectedRecipients] =
    useState<ShareRecipient[]>([]);
  const [recipientLookupLoading, setRecipientLookupLoading] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [savedShare, setSavedShare] =
    useState<ShareLink | null>(null);
  const [copied, setCopied] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;

    setError(null);
    setCopied(false);
    setSavedShare(null);
    setRecipientInput("");
    setRecipientLookupLoading(false);
    setChangeExpiration(false);

    if (existingShare) {
      setAccessType(existingShare.accessType);
      setPermission(existingShare.permission);
      setSelectedRecipients(
        existingShare.recipients ?? [],
      );
      setDuration("1d");
      setDurationUnit("days");
      return;
    }

    setAccessType("public");
    setPermission("viewer");
    setSelectedRecipients([]);
    setDuration("1d");
    setDurationUnit("days");
  }, [open, existingShare]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const resourceName =
    existingShare?.resource.name ??
    target?.name ??
    "this item";

  const recipientEmails = selectedRecipients.map(
    (recipient) => recipient.email,
  );

  const addRecipientByEmail = async () => {
    const email = recipientInput.trim().toLowerCase();

    setError(null);

    if (!email) return;

    if (!EMAIL_PATTERN.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (
      selectedRecipients.some(
        (recipient) =>
          recipient.email.toLowerCase() === email,
      )
    ) {
      setError("This user has already been added.");
      return;
    }

    if (selectedRecipients.length >= MAX_RECIPIENTS) {
      setError(
        `You can add at most ${MAX_RECIPIENTS} recipients.`,
      );
      return;
    }

    setRecipientLookupLoading(true);

    try {
      const recipient = await lookupShareRecipient(
        email,
      );

      setSelectedRecipients((current) => [
        ...current,
        {
          name: recipient.name,
          email: recipient.email,
        },
      ]);
      setRecipientInput("");
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "No active Storiffy user was found with this email address.",
        ),
      );
    } finally {
      setRecipientLookupLoading(false);
    }
  };

  const removeRecipient = (email: string) => {
    setSelectedRecipients((current) =>
      current.filter(
        (recipient) => recipient.email !== email,
      ),
    );
    setError(null);
  };

  const handleAccessChange = (value: string) => {
    const next = value as ShareAccessType;
    setAccessType(next);
    setError(null);

    if (next === "public") {
      setPermission("viewer");
      setSelectedRecipients([]);
      setRecipientInput("");
    }
  };

  const handlePermissionChange = (value: string) => {
    setPermission(value as SharePermission);
    setError(null);
  };

  const handleUnitChange = (value: string) => {
    const unit = value as DurationUnit;
    setDurationUnit(unit);
    setDuration(
      unit === "hours" ? "1h" : "1d",
    );
    setError(null);
  };

  const handleClose = (nextOpen: boolean) => {
    if (saving || recipientLookupLoading) {
      return;
    }

    onOpenChange(nextOpen);
  };

  const submit = async () => {
    setError(null);

    if (recipientInput.trim()) {
      setError(
        "Add the entered email before saving the share.",
      );
      return;
    }

    if (!editing && !target) {
      setError("No resource was selected for sharing.");
      return;
    }

    if (
      accessType === "restricted" &&
      selectedRecipients.length === 0
    ) {
      setError(
        "Add at least one registered Storiffy user for a restricted link.",
      );
      return;
    }

    setSaving(true);

    try {
      const saved = editing
        ? await updateShareLink(existingShare!.id, {
            accessType,
            ...(accessType === "restricted"
              ? {
                  permission,
                  recipientEmails,
                }
              : {}),
            ...(changeExpiration
              ? { duration }
              : {}),
          })
        : accessType === "public"
          ? await createPublicShare({
              resourceType: target!.type,
              resourceId: target!.id,
              duration,
            })
          : await createRestrictedShare({
              resourceType: target!.type,
              resourceId: target!.id,
              permission,
              recipientEmails,
              duration,
            });

      onSaved(saved);

      if (editing) {
        toast.add({
          title: "Share settings updated",
          description:
            "The existing share URL stays unchanged.",
          type: "success",
        });
        onOpenChange(false);
      } else {
        setSavedShare(saved);
        toast.add({
          title: "Share link created",
          description: "Your link is ready to share.",
          type: "success",
        });
      }
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Unable to save the share link.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const copyShareUrl = async () => {
    if (!savedShare) return;

    const url = absoluteShareUrl(savedShare.url);

    try {
      await copyText(url);
      setCopied(true);
      window.setTimeout(() =>
        setCopied(false),
        1800,
      );
    } catch {
      setError("Unable to copy the share link.");
    }
  };

  if (savedShare) {
    const url = absoluteShareUrl(savedShare.url);

    return (
      <Dialog
        open={open}
        onOpenChange={handleClose}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Link2 className="size-5" />
            </div>
            <DialogTitle>
              Link ready to share
            </DialogTitle>
            <DialogDescription>
              {resourceName} is available until{" "}
              {formatExpiry(savedShare.expiresAt)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {savedShare.accessType ===
                  "public"
                    ? "Public"
                    : "Restricted"}
                </Badge>
                <Badge variant="outline">
                  {savedShare.permission ===
                  "editor"
                    ? "Editor"
                    : "Viewer"}
                </Badge>
              </div>
              <p className="break-all text-sm leading-6 text-slate-700">
                {url}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() =>
                  void copyShareUrl()
                }
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Clipboard className="size-4" />
                )}
                {copied ? "Copied" : "Copy link"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  window.open(
                    url,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                <ExternalLink className="size-4" />
                Open
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onOpenChange(false)
              }
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? "Manage share link"
              : `Share ${resourceName}`}
          </DialogTitle>
          <DialogDescription>
            Choose who can access this item, what they can do, and when the link expires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <Label className="text-sm font-semibold text-slate-900">
                Access
              </Label>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Public links are available to anyone with the URL. Restricted links are limited to active Storiffy accounts you choose.
              </p>
            </div>

            <RadioGroup
              aria-label="Access"
              value={accessType}
              onValueChange={
                handleAccessChange
              }
              className="grid gap-3 sm:grid-cols-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 has-[[data-checked]]:border-blue-500 has-[[data-checked]]:bg-blue-50/60">
                <RadioGroupItem
                  value="public"
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">
                    Anyone with the link
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    No login required. Viewer only.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 has-[[data-checked]]:border-blue-500 has-[[data-checked]]:bg-blue-50/60">
                <RadioGroupItem
                  value="restricted"
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">
                    Restricted
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Only selected active Storiffy users can access it.
                  </span>
                </span>
              </label>
            </RadioGroup>
          </section>

          {accessType === "restricted" ? (
            <>
              <section className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900">
                  Permission
                </Label>

                <RadioGroup
                  aria-label="Permission"
                  value={permission}
                  onValueChange={
                    handlePermissionChange
                  }
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 has-[[data-checked]]:border-blue-500 has-[[data-checked]]:bg-blue-50/60">
                    <RadioGroupItem
                      value="viewer"
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">
                        Viewer
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Browse, preview and download.
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 has-[[data-checked]]:border-blue-500 has-[[data-checked]]:bg-blue-50/60">
                    <RadioGroupItem
                      value="editor"
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">
                        Editor
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Rename, create folders, upload and manage eligible content.
                      </span>
                    </span>
                  </label>
                </RadioGroup>
              </section>

              <section className="space-y-3">
                <div>
                  <Label
                    htmlFor="share-recipient-email"
                    className="text-sm font-semibold text-slate-900"
                  >
                    Recipients
                  </Label>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Enter the email address used by a registered active Storiffy account.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="share-recipient-email"
                    type="email"
                    value={recipientInput}
                    onChange={(event) => {
                      setRecipientInput(
                        event.target.value,
                      );
                      setError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void addRecipientByEmail();
                      }
                    }}
                    placeholder="friend@example.com"
                    autoComplete="off"
                    disabled={
                      recipientLookupLoading ||
                      selectedRecipients.length >=
                        MAX_RECIPIENTS
                    }
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      void addRecipientByEmail()
                    }
                    disabled={
                      recipientLookupLoading ||
                      !recipientInput.trim() ||
                      selectedRecipients.length >=
                        MAX_RECIPIENTS
                    }
                    className="sm:w-auto"
                  >
                    {recipientLookupLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Add
                  </Button>
                </div>

                {selectedRecipients.length > 0 ? (
                  <div className="rounded-xl border bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <Users className="size-3.5" />
                        {selectedRecipients.length}{" "}
                        recipient
                        {selectedRecipients.length ===
                        1
                          ? ""
                          : "s"}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {MAX_RECIPIENTS -
                          selectedRecipients.length}{" "}
                        remaining
                      </span>
                    </div>

                    <div className="space-y-2">
                      {selectedRecipients.map(
                        (recipient) => (
                          <div
                            key={recipient.email}
                            className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {recipient.name}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {recipient.email}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                removeRecipient(
                                  recipient.email,
                                )
                              }
                              className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              aria-label={`Remove ${recipient.email}`}
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}

          <section className="space-y-3">
            {editing ? (
              <div className="flex flex-col gap-3 rounded-xl border bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Label className="text-sm font-semibold text-slate-900">
                    Expiration
                  </Label>
                  <p className="mt-1 text-xs text-slate-500">
                    Current expiry: {" "}
                    {formatExpiry(
                      existingShare!.expiresAt,
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={
                    changeExpiration
                      ? "secondary"
                      : "outline"
                  }
                  onClick={() =>
                    setChangeExpiration(
                      (current) => !current,
                    )
                  }
                  className="shrink-0"
                >
                  {changeExpiration
                    ? "Choose new expiry"
                    : "Change expiration"}
                </Button>
              </div>
            ) : (
              <div>
                <Label className="text-sm font-semibold text-slate-900">
                  Link expiration
                </Label>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Maximum lifetime is 7 days. There is no never option.
                </p>
              </div>
            )}

            {!editing || changeExpiration ? (
              <Tabs
                value={durationUnit}
                onValueChange={
                  handleUnitChange
                }
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger
                    value="hours"
                    className="data-active:bg-blue-600 data-active:text-white data-active:shadow-sm"
                  >
                    Hours
                  </TabsTrigger>
                  <TabsTrigger
                    value="days"
                    className="data-active:bg-blue-600 data-active:text-white data-active:shadow-sm"
                  >
                    Days
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="hours"
                  className="mt-3"
                >
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {HOUR_DURATIONS.map(
                      (option) => {
                        const selected =
                          duration ===
                          option.value;

                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant="outline"
                            className={
                              selected
                                ? "h-auto min-h-14 border-blue-600 bg-blue-50 px-3 py-3 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
                                : "h-auto min-h-14 border-slate-200 bg-white px-3 py-3 text-slate-700 hover:bg-slate-50"
                            }
                            onClick={() =>
                              setDuration(
                                option.value,
                              )
                            }
                          >
                            <span className="flex items-center justify-center gap-2">
                              {selected ? (
                                <Check className="size-4" />
                              ) : null}
                              {option.label}
                            </span>
                          </Button>
                        );
                      },
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="days"
                  className="mt-3"
                >
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {DAY_DURATIONS.map(
                      (option) => {
                        const selected =
                          duration ===
                          option.value;

                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant="outline"
                            className={
                              selected
                                ? "h-auto min-h-14 border-blue-600 bg-blue-50 px-3 py-3 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
                                : "h-auto min-h-14 border-slate-200 bg-white px-3 py-3 text-slate-700 hover:bg-slate-50"
                            }
                            onClick={() =>
                              setDuration(
                                option.value,
                              )
                            }
                          >
                            <span className="flex items-center justify-center gap-2">
                              {selected ? (
                                <Check className="size-4" />
                              ) : null}
                              {option.label}
                            </span>
                          </Button>
                        );
                      },
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            ) : null}
          </section>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={
              saving || recipientLookupLoading
            }
            onClick={() =>
              onOpenChange(false)
            }
          >
            Cancel
          </Button>

          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={
              saving || recipientLookupLoading
            }
            onClick={() => void submit()}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            {editing ? "Save changes" : "Create link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
