import type { Role } from "@elevenlabs/client";
import type { TranscriptEntry } from "../contexts/conversation";
import type { ConversationMode } from "../contexts/conversation-mode";

export const ToolCallStatus = {
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
} as const;

export type ToolCallStatusType = (typeof ToolCallStatus)[keyof typeof ToolCallStatus];

export type DisplayTranscriptEntry =
  | {
      type: "message";
      role: Role;
      message: string;
      isText: boolean;
      conversationIndex: number;
      eventId?: number;
      toolStatus?: ToolCallStatusType;
    }
  | {
      type: "disconnection";
      role: Role;
      message?: undefined;
      conversationIndex: number;
    }
  | {
      type: "error";
      message: string;
      conversationIndex: number;
    }
  | {
      type: "mode_toggle";
      mode: ConversationMode;
      conversationIndex: number;
    };

export interface DisplayTranscriptConfig {
  showAgentStatus: boolean;
  transcriptEnabled: boolean;
  /** If set, prepend as the first agent message (for text-only first message). */
  firstMessage?: string;
  /** The conversationIndex to use for the prepended first message. */
  firstMessageConversationIndex?: number;
}

export function buildDisplayTranscript(
  entries: TranscriptEntry[],
  config: DisplayTranscriptConfig
): DisplayTranscriptEntry[] {
  const result: DisplayTranscriptEntry[] = [];

  // Prepend first message if configured
  if (config.firstMessage) {
    result.push({
      type: "message",
      role: "agent",
      message: config.firstMessage,
      isText: true,
      conversationIndex: entries[0]?.conversationIndex ?? config.firstMessageConversationIndex ?? 0,
    });
  }

  // Collect tool statuses per eventId
  const toolStatuses = new Map<string, { loading: number; error: number; success: number }>();
  for (const entry of entries) {
    if (entry.type === "agent_tool_request") {
      const s = toolStatuses.get(`${entry.conversationIndex}:${entry.eventId}`) ?? {
        loading: 0,
        error: 0,
        success: 0,
      };
      s.loading++;
      toolStatuses.set(`${entry.conversationIndex}:${entry.eventId}`, s);
    } else if (entry.type === "agent_tool_response") {
      const s = toolStatuses.get(`${entry.conversationIndex}:${entry.eventId}`);
      if (s) {
        s.loading--;
        if (entry.isError) s.error++;
        else s.success++;
      }
    }
  }

  let toolBoundary = false;
  for (const entry of entries) {
    // Skip tool entries (consumed into status)
    if (entry.type === "agent_tool_request" || entry.type === "agent_tool_response") {
      toolBoundary = true;
      continue;
    }

    // Skip empty agent messages unless they have a tool status to display
    if (
      entry.type === "message" &&
      entry.role === "agent" &&
      !entry.message &&
      !(
        config.showAgentStatus &&
        entry.eventId != null &&
        toolStatuses.has(`${entry.conversationIndex}:${entry.eventId}`)
      )
    )
      continue;

    // Filter non-text messages when transcript is disabled
    if (!config.transcriptEnabled && entry.type === "message" && !entry.isText) continue;

    // Preserve ordinary partial/final replacement, but not across a tool boundary.
    const prev = result[result.length - 1];
    if (
      entry.type === "message" &&
      entry.eventId != null &&
      prev?.type === "message" &&
      prev.eventId === entry.eventId &&
      prev.role === entry.role &&
      prev.conversationIndex === entry.conversationIndex &&
      (!toolBoundary || !prev.message.trim())
    ) {
      result[result.length - 1] = entry;
      toolBoundary = false;
      continue;
    }

    result.push(entry);
    toolBoundary = false;
  }

  // Attach one tool status per turn, scoped to its conversation.
  if (config.showAgentStatus) {
    const statusAttached = new Set<string>();
    for (let i = 0; i < result.length; i++) {
      const entry = result[i];
      if (entry.type !== "message" || entry.role !== "agent" || entry.eventId == null) continue;
      const key = `${entry.conversationIndex}:${entry.eventId}`;
      if (statusAttached.has(key)) continue;
      const status = toolStatuses.get(`${entry.conversationIndex}:${entry.eventId}`);
      if (!status) continue;

      const toolStatus: ToolCallStatusType =
        status.loading > 0
          ? ToolCallStatus.LOADING
          : status.error > 0
            ? ToolCallStatus.ERROR
            : ToolCallStatus.SUCCESS;
      result[i] = { ...entry, toolStatus };
      statusAttached.add(key);
    }
  }

  return result;
}
