import { signal } from "@preact/signals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { followConversationVolume } from "./volume";

describe("followConversationVolume", () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => frames.push(callback))
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup(disconnected: boolean) {
    const orb = { updateVolume: vi.fn() };
    const conversation = {
      isDisconnected: signal(disconnected),
      isSpeaking: signal(false),
      getInputVolume: () => 0.3,
      getOutputVolume: () => 0.8,
    };
    const dispose = followConversationVolume(orb, conversation);
    const nextFrame = () => frames.shift()!(0);
    return { orb, conversation, dispose, nextFrame };
  }

  it("settles the orb and stops polling while disconnected", () => {
    const { orb } = setup(true);

    expect(orb.updateVolume).toHaveBeenCalledWith(0, 0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("follows the user while listening and the agent while it speaks", () => {
    const { orb, conversation, nextFrame } = setup(false);

    nextFrame();
    expect(orb.updateVolume).toHaveBeenLastCalledWith(0.3, 0);

    conversation.isSpeaking.value = true;
    nextFrame();
    expect(orb.updateVolume).toHaveBeenLastCalledWith(0, 0.8);
  });

  it("stops polling when the conversation ends and resumes when it reconnects", () => {
    const { orb, conversation, nextFrame } = setup(false);
    nextFrame();

    conversation.isDisconnected.value = true;
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(orb.updateVolume).toHaveBeenLastCalledWith(0, 0);
    const scheduled = vi.mocked(requestAnimationFrame).mock.calls.length;

    conversation.isDisconnected.value = false;
    expect(requestAnimationFrame).toHaveBeenCalledTimes(scheduled + 1);
  });

  it("cancels the pending frame when disposed", () => {
    const { dispose } = setup(false);

    dispose();

    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
