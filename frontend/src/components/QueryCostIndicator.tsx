"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CircleDollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  queryCost: number;
  sessionCost: number;
  visible: boolean;
}

export default function QueryCostIndicator({ queryCost, sessionCost, visible }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-30"
        >
          <Card className="hidden md:block">
            <CardContent className="space-y-3 p-4 text-xs">
              <div className="flex items-center gap-2 text-foreground">
                <CircleDollarSign className="h-4 w-4 text-primary" />
                Cost trace
              </div>
              <div className="text-muted-foreground">
                This query: <span className="font-mono text-foreground">~${queryCost.toFixed(2)}</span>
              </div>
              <div className="text-muted-foreground">
                Session: <span className="font-mono text-foreground">~${sessionCost.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
