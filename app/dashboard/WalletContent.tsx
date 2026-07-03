"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Phone,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import Alert from "@/app/ui/Alert";
import { useDashboard } from "./DashboardContext";
import { processWithdrawal } from "@/app/actions/transactions";
import { getUserBalance } from "@/app/actions/deposit";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  formatPhoneNumber,
  getMpesaPhoneFormat,
} from "@/app/lib/utils/phoneFormatter";

const MIN_WITHDRAWAL = 200;

// Band-based processing fee calculation
function calculateProcessingFee(amount: number): number {
  if (amount >= 200 && amount <= 1000) return 10;
  if (amount > 1000 && amount <= 2000) return 20;
  if (amount > 2000 && amount <= 5000) return 30;
  if (amount > 5000 && amount <= 10000) return 50;
  if (amount > 10000) return 100;
  return 0;
}

function getFeeBandDescription(amount: number): string {
  if (amount >= 200 && amount <= 1000) return "KSh 200 - 1,000";
  if (amount > 1000 && amount <= 2000) return "KSh 1,001 - 2,000";
  if (amount > 2000 && amount <= 5000) return "KSh 2,001 - 5,000";
  if (amount > 5000 && amount <= 10000) return "KSh 5,001 - 10,000";
  if (amount > 10000) return "Above KSh 10,000";
  return "";
}

function formatPhoneForDisplay(phone: string): string {
  if (!phone) return "";
  try {
    const formatted = formatPhoneNumber(phone);
    if (formatted.startsWith("+254")) return `0${formatted.substring(4)}`;
    return formatted;
  } catch {
    return phone;
  }
}

export function WalletContent({
  initialBalance,
  userPhone,
}: {
  initialBalance: number;
  userPhone: string;
}) {
  const router = useRouter();

  // Ephemeral form state (rule 6)
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [mpesaNumber, setMpesaNumber] = useState(userPhone || "");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info"
  );

  // React Query for balance with auto-refetch (rule 2 & 3)
  const { data: balanceData, refetch: refetchBalance } = useQuery({
    queryKey: ["userBalance"],
    queryFn: async () => {
      const result = await getUserBalance();
      return result.data?.balance || initialBalance;
    },
    initialData: initialBalance,
    staleTime: 10 * 1000,
  });

  // Withdrawal mutation
  const withdrawalMutation = useMutation({
    mutationFn: async ({
      amount,
      mpesaNumber,
    }: {
      amount: number;
      mpesaNumber: string;
    }) => {
      const result = await processWithdrawal({ amount, mpesaNumber });
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: (result) => {
      setMessage(
        `Withdrawal request submitted! Transaction ID: ${result.data?.transactionCode}. ` +
          `Processing fee: KES ${result.data?.processingFee}. Pending admin approval.`
      );
      setMessageType("success");
      setWithdrawAmount("");
      refetchBalance();
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Withdrawal failed. Please try again."
      );
      setMessageType("error");
    },
  });

  const currentBalance = balanceData || initialBalance;
  const withdrawAmountNum = parseFloat(withdrawAmount) || 0;
  const processingFee = calculateProcessingFee(withdrawAmountNum);
  const totalDeduction = withdrawAmountNum + processingFee;
  const feeBand = getFeeBandDescription(withdrawAmountNum);

  const handleWithdraw = async () => {
    setMessage(null);
    const amount = parseFloat(withdrawAmount);

    if (isNaN(amount) || amount < MIN_WITHDRAWAL) {
      setMessage(`Minimum withdrawal amount is KES ${MIN_WITHDRAWAL}.`);
      setMessageType("error");
      return;
    }

    const fee = calculateProcessingFee(amount);
    const totalRequired = amount + fee;
    if (totalRequired > currentBalance) {
      setMessage(
        `Insufficient balance. You need KSh ${totalRequired.toFixed(0)} (amount + KSh ${fee} fee). Available: KSh ${currentBalance.toFixed(0)}.`
      );
      setMessageType("error");
      return;
    }

    const cleanMpesaNumber = mpesaNumber.replace(/\s/g, "");
    if (!cleanMpesaNumber.match(/^254[0-9]{9}$/)) {
      setMessage(
        "Please enter a valid M-Pesa number in format 2547XXXXXXXX or 2541XXXXXXXX."
      );
      setMessageType("error");
      return;
    }

    withdrawalMutation.mutate({ amount, mpesaNumber: cleanMpesaNumber });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Wallet & Withdrawals</h1>

        {message && (
          <Alert
            type={messageType}
            title={messageType === "success" ? "Success" : "Error"}
            onClose={() => setMessage(null)}
            className="mb-6"
          >
            {message}
          </Alert>
        )}

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-8 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 text-sm uppercase tracking-wide mb-2">
                Current Balance
              </p>
              <p className="text-4xl font-bold text-green-400">
                KES {currentBalance.toLocaleString()}
              </p>
              <p className="text-slate-400 text-sm mt-2">
                Available for withdrawal
              </p>
            </div>
            <button
              onClick={() => refetchBalance()}
              disabled={withdrawalMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${withdrawalMutation.isPending ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Withdrawal Form */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
          <h2 className="text-xl font-bold text-white mb-6">Request Withdrawal</h2>

          <div className="space-y-6">
            {/* Amount Input */}
            <div>
              <label className="block text-slate-300 font-medium mb-2">
                <DollarSign className="inline w-4 h-4 mr-2" />
                Amount (KES)
              </label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount"
                min={MIN_WITHDRAWAL}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-2">
                Minimum: KES {MIN_WITHDRAWAL}
              </p>
            </div>

            {/* Fee Preview */}
            {withdrawAmountNum >= MIN_WITHDRAWAL && (
              <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                <p className="text-sm text-slate-300 mb-3">Fee Breakdown</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Amount Band:</span>
                    <span className="text-white font-medium">{feeBand}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Processing Fee:</span>
                    <span className="text-yellow-400 font-medium">
                      KES {processingFee}
                    </span>
                  </div>
                  <div className="border-t border-slate-600 pt-2 flex justify-between text-slate-300 font-medium">
                    <span>Total Deduction:</span>
                    <span className="text-green-400">KES {totalDeduction}</span>
                  </div>
                </div>
              </div>
            )}

            {/* M-Pesa Number */}
            <div>
              <label className="block text-slate-300 font-medium mb-2">
                <Phone className="inline w-4 h-4 mr-2" />
                M-Pesa Number
              </label>
              <input
                type="tel"
                value={mpesaNumber}
                onChange={(e) => setMpesaNumber(e.target.value)}
                placeholder="2547XXXXXXXX or 2541XXXXXXXX"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-2">
                Format: 254XXXXXXXXX (11 digits including country code)
              </p>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleWithdraw}
              disabled={
                withdrawalMutation.isPending ||
                !withdrawAmount ||
                withdrawAmountNum < MIN_WITHDRAWAL
              }
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {withdrawalMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Withdrawal
                </>
              )}
            </button>

            {/* Info Box */}
            <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                <AlertCircle className="inline w-4 h-4 mr-2" />
                Withdrawals require admin approval. You&apos;ll be notified once
                processed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
