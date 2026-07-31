import type { Json } from "@/types/database";

type JsonObject = { [key: string]: Json | undefined };

export type DeletionRequestStatus = "none" | "requested" | "cancelled";

export type DeletionRequestState = {
  status: DeletionRequestStatus;
  requestedAt: string | null;
  cancelledAt: string | null;
  requestId: string | null;
};

export type ConsentPreferences = {
  productUpdates: boolean;
  usageAnalytics: boolean;
  updatedAt: string | null;
  policyVersion: string | null;
};

const USER_PRIVACY_KEY = "estate_brain_privacy";

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function jsonObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {};
}

function stringOrNull(value: Json | undefined) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function deletionRequestState(value: unknown): DeletionRequestState {
  const request = jsonObject(value);
  const status =
    request.status === "requested" || request.status === "cancelled"
      ? request.status
      : "none";

  return {
    status,
    requestedAt: stringOrNull(request.requested_at),
    cancelledAt: stringOrNull(request.cancelled_at),
    requestId: stringOrNull(request.request_id),
  };
}

function userPrivacyObject(metadata: unknown) {
  return jsonObject(jsonObject(metadata)[USER_PRIVACY_KEY]);
}

export function readConsentPreferences(metadata: unknown): ConsentPreferences {
  const consents = jsonObject(userPrivacyObject(metadata).consents);

  return {
    productUpdates: consents.product_updates === true,
    usageAnalytics: consents.usage_analytics === true,
    updatedAt: stringOrNull(consents.updated_at),
    policyVersion: stringOrNull(consents.policy_version),
  };
}

export function readAccountDeletionRequest(
  metadata: unknown,
): DeletionRequestState {
  return deletionRequestState(
    userPrivacyObject(metadata).account_deletion_request,
  );
}

export function withConsentPreferences(
  metadata: unknown,
  preferences: {
    productUpdates: boolean;
    usageAnalytics: boolean;
    updatedAt: string;
    policyVersion: string;
  },
): JsonObject {
  const root = jsonObject(metadata);
  const privacy = userPrivacyObject(root);

  return {
    ...root,
    [USER_PRIVACY_KEY]: {
      ...privacy,
      version: 1,
      consents: {
        ...jsonObject(privacy.consents),
        product_updates: preferences.productUpdates,
        usage_analytics: preferences.usageAnalytics,
        updated_at: preferences.updatedAt,
        policy_version: preferences.policyVersion,
      },
    },
  };
}

export function withAccountDeletionRequest(
  metadata: unknown,
  request: {
    status: Exclude<DeletionRequestStatus, "none">;
    requestedAt: string | null;
    cancelledAt: string | null;
    organizationId: string | null;
    reason: string | null;
  },
): JsonObject {
  const root = jsonObject(metadata);
  const privacy = userPrivacyObject(root);

  return {
    ...root,
    [USER_PRIVACY_KEY]: {
      ...privacy,
      version: 1,
      account_deletion_request: {
        status: request.status,
        requested_at: request.requestedAt,
        cancelled_at: request.cancelledAt,
        organization_id: request.organizationId,
        reason: request.reason,
      },
    },
  };
}
