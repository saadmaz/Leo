"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Globe, PencilLine, Save } from "lucide-react";
import { ProductContext } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  product: ProductContext;
  onUpdate: (product: ProductContext) => void;
  compact?: boolean;
}

export default function ProductContextBar({ product, onUpdate, compact = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [url, setUrl] = useState(product.url);

  const handleSave = () => {
    onUpdate({ name, url });
    setEditing(false);
  };

  return (
    <Card className="w-full rounded-[26px]">
      <CardContent
        className={cn(
          "flex flex-col transition-all duration-300 md:flex-row md:items-center md:justify-between",
          compact ? "gap-3 p-3" : "gap-4 p-4"
        )}
      >
        <div className={cn("flex items-center", compact ? "gap-2.5" : "gap-3")}>
          <div
            className={cn(
              "flex items-center justify-center rounded-2xl border border-border bg-muted text-foreground transition-all duration-300",
              compact ? "h-9 w-9" : "h-11 w-11"
            )}
          >
            <Globe className="h-5 w-5" />
          </div>
          {editing ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Company or product name" />
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="product URL" />
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <p className={cn("font-semibold text-foreground transition-all duration-300", compact ? "text-[13px]" : "text-sm")}>
                  {product.name}
                </p>
                <Badge variant="default" className="normal-case tracking-normal text-[10px]">
                  Active target
                </Badge>
              </div>
              <p className={cn("text-muted-foreground transition-all duration-300", compact ? "mt-0.5 text-xs" : "mt-1 text-sm")}>
                {product.url}
              </p>
            </div>
          )}
        </div>
        {editing ? (
          <Button onClick={handleSave} size="sm" className="rounded-xl">
            <Save className="h-4 w-4" />
            Save target
          </Button>
        ) : (
          <Button onClick={() => setEditing(true)} variant="outline" size="sm" className={cn("rounded-xl", compact && "h-8 px-3 text-xs")}>
            <PencilLine className="h-4 w-4" />
            Change product
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
