"use client";

import { SparklesIcon } from "lucide-react";
import type { JSX, ReactNode } from "react";

import { cn } from "@/lib/class-names";

type Block =
  | {
      readonly kind: "paragraph";
      readonly start: number;
      readonly text: string;
    }
  | {
      readonly kind: "list";
      readonly start: number;
      readonly items: readonly string[];
    };

const LIST_MARKER = "- ";

// Consecutive "- " lines become a list and everything else stays a
// pre-wrapped paragraph. This is not Markdown, and the result is React
// elements around text nodes only (AI-R52).
export function splitBlocks(text: string): readonly Block[] {
  const blocks: Block[] = [];
  text.split("\n").forEach((line, index) => {
    const last = blocks.at(-1);
    if (line.startsWith(LIST_MARKER)) {
      const item = line.slice(LIST_MARKER.length);
      if (last?.kind === "list") {
        blocks[blocks.length - 1] = { ...last, items: [...last.items, item] };
      } else {
        blocks.push({ kind: "list", start: index, items: [item] });
      }
    } else if (last?.kind === "paragraph") {
      blocks[blocks.length - 1] = { ...last, text: `${last.text}\n${line}` };
    } else {
      blocks.push({ kind: "paragraph", start: index, text: line });
    }
  });
  return blocks;
}

// A blinking caret while the text streams; static under reduced motion.
const CARET_CLASS_NAME =
  "after:ml-0.5 after:inline-block after:h-[1.05em] after:w-0.5 after:bg-current after:align-text-bottom after:content-[''] after:animate-pulse motion-reduce:after:animate-none";

export function PlainText({
  text,
  hasCaret = false,
}: {
  readonly text: string;
  readonly hasCaret?: boolean;
}): JSX.Element {
  const blocks = splitBlocks(text);

  return (
    <div className="flex flex-col gap-1 [overflow-wrap:anywhere]">
      {blocks.map((block, index) => {
        const hasLastCaret = hasCaret && index === blocks.length - 1;
        return block.kind === "list" ? (
          <ul key={block.start} className="list-disc pl-4.5">
            {block.items.map((item, itemIndex) => (
              <li
                key={block.start + itemIndex}
                className={cn(
                  hasLastCaret &&
                    itemIndex === block.items.length - 1 &&
                    CARET_CLASS_NAME,
                )}
              >
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p
            key={block.start}
            className={cn(
              "whitespace-pre-wrap",
              hasLastCaret && CARET_CLASS_NAME,
            )}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

export function AssistantAvatar({
  isLarge = false,
}: {
  readonly isLarge?: boolean;
}): JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-border bg-accent text-accent-foreground",
        isLarge ? "size-12" : "size-7",
      )}
    >
      <SparklesIcon className={isLarge ? "size-6" : "size-4"} />
    </span>
  );
}

export function TypingDots(): JSX.Element {
  return (
    <span aria-hidden className="inline-flex gap-1 py-1.5">
      {[0, 150, 300].map((delay) => (
        <i
          key={delay}
          style={{ animationDelay: `${String(delay)}ms` }}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"
        />
      ))}
    </span>
  );
}

export type MessageBubbleProps = {
  readonly sender: "user" | "assistant";
  // The first bubble of a group carries the small tail corner.
  readonly hasTail: boolean;
  // Partial text of a failed turn: muted, dashed.
  readonly isMuted?: boolean;
  readonly children: ReactNode;
};

export function MessageBubble({
  sender,
  hasTail,
  isMuted = false,
  children,
}: MessageBubbleProps): JSX.Element {
  const isUser = sender === "user";

  return (
    <div
      className={cn(
        "max-w-full min-w-0 self-start rounded-2xl px-3 py-2 text-sm",
        isUser
          ? "self-end bg-bubble-user text-bubble-user-foreground"
          : "border border-border bg-bubble-assistant text-bubble-assistant-foreground",
        hasTail && (isUser ? "rounded-tr-sm" : "rounded-tl-sm"),
        isMuted && "border-dashed text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}
