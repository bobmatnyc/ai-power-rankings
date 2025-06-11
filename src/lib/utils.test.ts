import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names correctly", () => {
      expect(cn("px-2", "py-1")).toBe("px-2 py-1");
    });

    it("should handle conditional classes", () => {
      expect(cn("base", true && "conditional", false && "hidden")).toBe("base conditional");
    });

    it("should merge conflicting Tailwind classes", () => {
      expect(cn("px-2", "px-4")).toBe("px-4");
    });

    it("should handle empty inputs", () => {
      expect(cn()).toBe("");
    });

    it("should handle undefined and null values", () => {
      expect(cn("base", undefined, null, "end")).toBe("base end");
    });

    it("should handle array inputs", () => {
      expect(cn(["px-2", "py-1"])).toBe("px-2 py-1");
    });

    it("should handle object inputs", () => {
      expect(cn({ "px-2": true, "py-1": false, "text-red": true })).toBe("px-2 text-red");
    });
  });
});
