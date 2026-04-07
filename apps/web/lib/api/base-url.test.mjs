import test from "node:test";
import assert from "node:assert/strict";

import { buildApiUrl, normalizeApiBaseUrl } from "./base-url.ts";

test("normalizeApiBaseUrl removes a trailing slash", () => {
    assert.equal(
        normalizeApiBaseUrl("https://munet-api.vercel.app/"),
        "https://munet-api.vercel.app",
    );
});

test("buildApiUrl joins the API base and path with a single slash", () => {
    assert.equal(
        buildApiUrl("https://munet-api.vercel.app/", "/auth/login"),
        "https://munet-api.vercel.app/auth/login",
    );
});
