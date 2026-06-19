'use client';

import { FileText, Plus, ShoppingCart, TrendingUp } from 'lucide-react';

export default function DigitalProductsPage() {
  const stats = [
    { label: 'Products Uploaded', value: '5', icon: ShoppingCart },
    { label: 'Total Sales', value: '127', icon: TrendingUp },
    { label: 'Earnings', value: 'KES 18,500', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
          Digital Products Store
        </h1>
        <button className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all">
          <Plus className="w-5 h-5" />
          Upload Product
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon as any;
          return (
            <div key={idx} className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-600 font-medium">{stat.label}</p>
                <Icon className="w-5 h-5 text-pink-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Products */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Your Products</h2>
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p>No products yet. Upload your first digital product!</p>
        </div>
      </div>
    </div>
  );
}
