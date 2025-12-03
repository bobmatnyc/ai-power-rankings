/**
 * Markdown Toolbar Component
 *
 * Quick insert buttons with keyboard shortcuts:
 * - Bold (**text**)
 * - Italic (*text*)
 * - Heading (# ## ###)
 * - Link ([text](url))
 * - Code (`code` or ```block```)
 * - List (- item or 1. item)
 * - Quote (> text)
 * - Image (![alt](url))
 * - Table generator
 * - Horizontal rule (---)
 *
 * Keyboard shortcuts:
 * - Ctrl/Cmd+B: Bold
 * - Ctrl/Cmd+I: Italic
 * - Ctrl/Cmd+K: Link
 * - Ctrl/Cmd+`: Code
 *
 * @example
 * <MarkdownToolbar
 *   textareaRef={textareaRef}
 *   onInsert={(text) => setValue(text)}
 * />
 */

"use client";

import { Button } from "@/components/ui/button";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table,
} from "lucide-react";
import { RefObject, useCallback, useEffect } from "react";

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInsert?: (newText: string) => void;
}

export function MarkdownToolbar({ textareaRef, onInsert }: MarkdownToolbarProps) {
  // Insert text at cursor position
  const insertText = useCallback(
    (before: string, after: string = "", placeholder: string = "") => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const selectedText = text.substring(start, end);

      const replacement = before + (selectedText || placeholder) + after;
      const newText = text.substring(0, start) + replacement + text.substring(end);

      // Update textarea value
      textarea.value = newText;

      // Trigger onChange event
      const event = new Event("input", { bubbles: true });
      textarea.dispatchEvent(event);

      // Call onInsert callback if provided
      if (onInsert) {
        onInsert(newText);
      }

      // Set cursor position
      const newCursorPos = start + before.length + (selectedText || placeholder).length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    },
    [textareaRef, onInsert]
  );

  // Toolbar actions
  const actions = {
    bold: () => insertText("**", "**", "bold text"),
    italic: () => insertText("*", "*", "italic text"),
    heading1: () => insertText("# ", "", "Heading 1"),
    heading2: () => insertText("## ", "", "Heading 2"),
    heading3: () => insertText("### ", "", "Heading 3"),
    link: () => insertText("[", "](https://example.com)", "link text"),
    image: () => insertText("![", "](https://example.com/image.png)", "alt text"),
    inlineCode: () => insertText("`", "`", "code"),
    codeBlock: () => insertText("```\n", "\n```", "code block"),
    unorderedList: () => insertText("- ", "", "list item"),
    orderedList: () => insertText("1. ", "", "list item"),
    quote: () => insertText("> ", "", "quote"),
    horizontalRule: () => insertText("\n---\n", "", ""),
    table: () => {
      const tableTemplate = `| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`;
      insertText("\n" + tableTemplate + "\n", "", "");
    },
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts if textarea is focused
      if (document.activeElement !== textareaRef.current) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            actions.bold();
            break;
          case "i":
            e.preventDefault();
            actions.italic();
            break;
          case "k":
            e.preventDefault();
            actions.link();
            break;
          case "`":
            e.preventDefault();
            actions.inlineCode();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [actions, textareaRef]);

  return (
    <div className="flex flex-wrap gap-1 p-2 border rounded-lg bg-muted/30">
      {/* Text Formatting */}
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.bold}
          title="Bold (Ctrl/Cmd+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.italic}
          title="Italic (Ctrl/Cmd+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Headings */}
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.heading1}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.heading2}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.heading3}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Links and Images */}
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.link}
          title="Link (Ctrl/Cmd+K)"
        >
          <Link className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.image}
          title="Image"
        >
          <Image className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Code */}
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.inlineCode}
          title="Inline Code (Ctrl/Cmd+`)"
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.codeBlock}
          title="Code Block"
        >
          <Code className="h-4 w-4 mr-1" />
          Block
        </Button>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Lists */}
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.unorderedList}
          title="Unordered List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.orderedList}
          title="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.quote}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Advanced */}
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.table}
          title="Insert Table"
        >
          <Table className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={actions.horizontalRule}
          title="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="ml-auto text-xs text-muted-foreground self-center hidden md:block">
        Tip: Use Ctrl/Cmd+B (bold), I (italic), K (link)
      </div>
    </div>
  );
}
