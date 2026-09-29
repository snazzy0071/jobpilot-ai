"use client";

import { useState } from "react";
import { PlusIcon, Trash2Icon, ChevronUpIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ContentBlock } from "@/lib/content/blocks";

const BLOCK_TYPES = ["paragraph", "heading", "list", "quote"] as const;

function emptyBlock(type: ContentBlock["type"]): ContentBlock {
  if (type === "heading") return { type: "heading", level: 2, id: "", text: "" };
  if (type === "list") return { type: "list", items: [""] };
  if (type === "quote") return { type: "quote", text: "" };
  return { type: "paragraph", text: "" };
}

/**
 * Mirrors src/lib/content/blocks.ts's own ContentBlock union exactly —
 * one repeatable row per block, type-specific fields, and a single
 * hidden `content` input holding the serialized array, since there's
 * no clean way to represent a dynamic, per-type-shaped array as
 * individually-named form fields. The server (src/lib/admin/blog/
 * schemas.ts) parses and re-validates that JSON rather than trusting
 * it blind.
 */
export function ContentBlockEditor({ initialBlocks }: { initialBlocks: ContentBlock[] }) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialBlocks.length > 0 ? initialBlocks : [emptyBlock("paragraph")]);

  function updateBlock(index: number, next: ContentBlock) {
    setBlocks((prev) => prev.map((block, i) => (i === index ? next : block)));
  }
  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }
  function addBlock(type: ContentBlock["type"]) {
    setBlocks((prev) => [...prev, emptyBlock(type)]);
  }
  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="content" value={JSON.stringify(blocks)} />
      {blocks.map((block, index) => (
        <Card key={index} className="gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">{block.type}</span>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" onClick={() => moveBlock(index, -1)} disabled={index === 0}>
                <ChevronUpIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Move down"
                onClick={() => moveBlock(index, 1)}
                disabled={index === blocks.length - 1}
              >
                <ChevronDownIcon className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove block" onClick={() => removeBlock(index)}>
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          </div>

          {block.type === "paragraph" && (
            <Textarea rows={3} value={block.text} onChange={(event) => updateBlock(index, { ...block, text: event.target.value })} placeholder="Paragraph text" />
          )}

          {block.type === "quote" && (
            <Textarea rows={2} value={block.text} onChange={(event) => updateBlock(index, { ...block, text: event.target.value })} placeholder="Quote text" />
          )}

          {block.type === "heading" && (
            <div className="grid gap-2 sm:grid-cols-4">
              <Select items={{ "2": "H2", "3": "H3" }} value={String(block.level)} onValueChange={(value) => value && updateBlock(index, { ...block, level: Number(value) as 2 | 3 })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">H2</SelectItem>
                  <SelectItem value="3">H3</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={block.id}
                onChange={(event) => updateBlock(index, { ...block, id: event.target.value })}
                placeholder="anchor-id"
              />
              <Input
                value={block.text}
                onChange={(event) => updateBlock(index, { ...block, text: event.target.value })}
                placeholder="Heading text"
                className="sm:col-span-2"
              />
            </div>
          )}

          {block.type === "list" && (
            <div className="flex flex-col gap-2">
              {block.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex gap-2">
                  <Input
                    value={item}
                    onChange={(event) => {
                      const items = [...block.items];
                      items[itemIndex] = event.target.value;
                      updateBlock(index, { ...block, items });
                    }}
                    placeholder="List item"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove item"
                    onClick={() => updateBlock(index, { ...block, items: block.items.filter((_, i) => i !== itemIndex) })}
                    disabled={block.items.length <= 1}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => updateBlock(index, { ...block, items: [...block.items, ""] })}
              >
                <PlusIcon className="size-4" /> Add item
              </Button>
            </div>
          )}
        </Card>
      ))}

      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map((type) => (
          <Button key={type} type="button" variant="outline" size="sm" onClick={() => addBlock(type)}>
            <PlusIcon className="size-4" /> Add {type}
          </Button>
        ))}
      </div>
    </div>
  );
}
