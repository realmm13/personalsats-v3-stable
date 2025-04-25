import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Clock } from "lucide-react";

interface Trade { id: string; type: 'buy' | 'sell'; amount: number; date: string; }

interface Props { trades: Trade[] }

export default function TransactionList({ trades }: Props) {
  return (
    <div className="space-y-4">
      {trades.map(t => (
        <Card key={t.id} className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2 rounded-full">
              {t.type === 'buy' ? <ArrowUpRight /> : <Clock />}
            </div>
            <div>
              <p className="font-medium">{t.type.toUpperCase()} {t.amount} BTC</p>
              <p className="text-xs text-muted-foreground">{t.date}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm">Details</Button>
        </Card>
      ))}
    </div>
  );
} 