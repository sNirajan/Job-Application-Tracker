const { canTransition, getNextStatuses, isTerminal } = require("../../src/utils/statusMachine");

describe("canTransition", () => {
  // The happy path, these transitions should be allowed
  it("should allow wishlist to applied", () => {
    expect(canTransition("wishlist", "applied")).toBe(true);
  });

  it("should allow applied to phone_screen", () => {
    expect(canTransition("applied", "phone_screen")).toBe(true);
  });

  // You can always withdraw from any active status
  it("should allow withdrawing from any active status", () => {
    expect(canTransition("wishlist", "withdrawn")).toBe(true);
    expect(canTransition("applied", "withdrawn")).toBe(true);
    expect(canTransition("onsite", "withdrawn")).toBe(true);
  });

  // Skipping steps should never work, no shortcuts in a real pipeline
  it("should block skipping from wishlist straight to offer", () => {
    expect(canTransition("wishlist", "offer")).toBe(false);
  });

  it("should block skipping from applied to onsite", () => {
    expect(canTransition("applied", "onsite")).toBe(false);
  });

  // Terminal states are dead ends, once you're rejected, you can't come back
  it("should block any transition out of rejected", () => {
    expect(canTransition("rejected", "applied")).toBe(false);
    expect(canTransition("rejected", "wishlist")).toBe(false);
  });

  it("should block any transition out of accepted", () => {
    expect(canTransition("accepted", "applied")).toBe(false);
  });

  // Edge case: garbage input shouldn't crash, should just return false
  it("should return false for completely invalid statuses", () => {
    expect(canTransition("banana", "applied")).toBe(false);
    expect(canTransition("wishlist", "banana")).toBe(false);
  });
});

describe("getNextStatuses", () => {
  // Wishlist is the starting point, you can only apply or withdraw
  it("should return correct options for wishlist", () => {
    expect(getNextStatuses("wishlist")).toEqual(["applied", "withdrawn"]);
  });

  // Offer is exciting, you can accept, reject, or withdraw
  it("should return correct options for offer", () => {
    expect(getNextStatuses("offer")).toEqual(["accepted", "rejected", "withdrawn"]);
  });

  // Terminal states have nowhere to go, empty array
  it("should return empty array for rejected", () => {
    expect(getNextStatuses("rejected")).toEqual([]);
  });

  it("should return empty array for accepted", () => {
    expect(getNextStatuses("accepted")).toEqual([]);
  });

  // Garbage input shouldn't crash, just return empty
  it("should return empty array for invalid status", () => {
    expect(getNextStatuses("banana")).toEqual([]);
  });
});

describe("isTerminal", () => {
  // These are dead ends, no transitions out
  it("should return true for rejected", () => {
    expect(isTerminal("rejected")).toBe(true);
  });

  it("should return true for accepted", () => {
    expect(isTerminal("accepted")).toBe(true);
  });

  it("should return true for withdrawn", () => {
    expect(isTerminal("withdrawn")).toBe(true);
  });

  // These still have moves available, not terminal
  it("should return false for wishlist", () => {
    expect(isTerminal("wishlist")).toBe(false);
  });

  it("should return false for applied", () => {
    expect(isTerminal("applied")).toBe(false);
  });
});