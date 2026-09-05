import assert from "node:assert/strict";
import test from "node:test";

import {
  getNextCustomerScreen,
  getPreviousCustomerScreen,
} from "../src/lib/customer/navigation.ts";

const baseContext = {
  isOwner: true,
  isCoOwned: false,
  knowsOwnerAvailability: null,
  hasDisputedPlate: false,
  useAgencyFallback: false,
};

test("uses the fixed order when the customer is the owner", () => {
  assert.equal(getNextCustomerScreen("owner", baseContext), "first_name");
  assert.equal(getPreviousCustomerScreen("first_name", baseContext), "owner");
  assert.equal(getNextCustomerScreen("agency", baseContext), "appointment");
  assert.equal(getPreviousCustomerScreen("appointment", baseContext), "agency");
});

test("includes the owner notice and availability question for a non-owner", () => {
  const context = {
    ...baseContext,
    isOwner: false,
    knowsOwnerAvailability: true,
  };

  assert.equal(getNextCustomerScreen("owner", context), "owner_notice");
  assert.equal(getPreviousCustomerScreen("first_name", context), "owner_notice");
  assert.equal(getNextCustomerScreen("agency", context), "owner_availability");
  assert.equal(getNextCustomerScreen("owner_availability", context), "appointment");
  assert.equal(getPreviousCustomerScreen("appointment", context), "owner_availability");
});

test("skips the appointment when a non-owner does not know the availability", () => {
  const context = {
    ...baseContext,
    isOwner: false,
    knowsOwnerAvailability: false,
  };

  assert.equal(
    getNextCustomerScreen("owner_availability", context),
    "availability_notice",
  );
  assert.equal(
    getNextCustomerScreen("availability_notice", context),
    "pickup_location",
  );
  assert.equal(
    getPreviousCustomerScreen("pickup_location", context),
    "availability_notice",
  );
});

test("includes the customer plate only after a dispute", () => {
  assert.equal(getNextCustomerScreen("plate", baseContext), "postal_code");
  const disputed = { ...baseContext, hasDisputedPlate: true };
  assert.equal(getNextCustomerScreen("plate", disputed), "customer_plate");
  assert.equal(getPreviousCustomerScreen("postal_code", disputed), "customer_plate");
});
