import { effect, type ReadonlySignal } from "@preact/signals";
import type { Orb } from "./Orb";

interface ConversationVolume {
  isDisconnected: ReadonlySignal<boolean>;
  isSpeaking: ReadonlySignal<boolean>;
  getInputVolume(): number;
  getOutputVolume(): number;
}

/**
 * Feeds the orb the agent's volume while it speaks and the user's while it
 * listens. Polling runs only while a conversation is connected; returns a
 * function that stops following.
 */
export function followConversationVolume(
  orb: Pick<Orb, "updateVolume">,
  conversation: ConversationVolume
): () => void {
  return effect(() => {
    if (conversation.isDisconnected.value) {
      orb.updateVolume(0, 0);
      return;
    }

    let id = 0;
    function update() {
      if (conversation.isSpeaking.peek()) {
        orb.updateVolume(0, conversation.getOutputVolume());
      } else {
        orb.updateVolume(conversation.getInputVolume(), 0);
      }
      id = requestAnimationFrame(update);
    }
    // Start on the next frame so reads inside update() never subscribe this effect.
    id = requestAnimationFrame(update);

    return () => cancelAnimationFrame(id);
  });
}
