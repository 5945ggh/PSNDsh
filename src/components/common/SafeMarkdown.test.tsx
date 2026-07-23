import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SafeMarkdown } from "./SafeMarkdown";

describe("SafeMarkdown", () => {
  it("renders common Markdown without trusting raw HTML", () => {
    const html = renderToStaticMarkup(
      <SafeMarkdown
        content={`## 本周重心
- **完成** 课程复盘
- 记录 \`LockLab\`
<script>alert(1)</script>`}
      />
    );

    expect(html).toContain("<h2");
    expect(html).toContain("<ul");
    expect(html).toContain("<strong");
    expect(html).toContain("<code");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("does not render unsafe links as anchors", () => {
    const html = renderToStaticMarkup(
      <SafeMarkdown content="[危险链接](javascript:alert(1)) 和 [安全链接](https://example.com)" />
    );

    expect(html).not.toContain("href=\"javascript:alert(1)\"");
    expect(html).toContain("href=\"https://example.com\"");
  });
});
