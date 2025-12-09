'use client';

/**
 * FIX IT - Currys Product Recommendation Panel
 * The "money moment" - shows Currys products when repair isn't feasible
 * Demonstrates ecosystem lock-in and upsell opportunity
 */

import { CurrysProduct } from '@/lib/types';

interface CurrysRecommendationPanelProps {
  products: CurrysProduct[];
  onClose: () => void;
  message?: string;
}

export default function CurrysRecommendationPanel({
  products,
  onClose,
  message = "Based on the issue, here are some recommended solutions from Currys:",
}: CurrysRecommendationPanelProps) {
  if (!products || products.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-6xl bg-slate-900/95 border-2 border-pink-500 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-6 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-5xl">🛒</span>
              <div>
                <h2 className="text-white text-2xl font-bold">
                  Currys Product Recommendations
                </h2>
                <p className="text-white/90 text-sm mt-1">{message}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-3xl font-light transition-colors"
              aria-label="Close recommendations"
            >
              ×
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden hover:border-pink-500 transition-all hover:scale-105 hover:shadow-lg hover:shadow-pink-500/20"
            >
              {/* Product Image Placeholder */}
              <div className="h-48 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                <span className="text-6xl opacity-50">📦</span>
              </div>

              {/* Product Details */}
              <div className="p-5">
                <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">
                  {product.name}
                </h3>

                <p className="text-pink-400 text-2xl font-bold mb-4">
                  £{product.price.toFixed(2)}
                </p>

                {/* Specs */}
                <div className="mb-5">
                  <p className="text-slate-400 text-xs uppercase font-semibold mb-2 tracking-wide">
                    Key Features
                  </p>
                  <ul className="space-y-1.5">
                    {product.specs.slice(0, 4).map((spec, idx) => (
                      <li
                        key={idx}
                        className="text-slate-300 text-sm flex items-start gap-2"
                      >
                        <span className="text-pink-400 text-xs mt-0.5">✓</span>
                        <span className="flex-1">{spec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <a
                  href={product.currysUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-center py-3 rounded-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-pink-500/50"
                >
                  View at Currys →
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 border-t border-slate-700 p-6 text-center">
          <p className="text-slate-400 text-sm">
            🔒 <span className="font-semibold">Ecosystem Integration:</span> Seamlessly
            transition from repair guidance to product recommendations
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Continue with Repair
          </button>
        </div>
      </div>
    </div>
  );
}
