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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-6xl my-auto bg-slate-900/95 border-2 border-pink-500 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-4 sm:p-6 sticky top-0 z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-4xl sm:text-5xl flex-shrink-0">🛒</span>
              <div className="min-w-0">
                <h2 className="text-white text-lg sm:text-2xl font-bold line-clamp-1">
                  Currys Product Recommendations
                </h2>
                <p className="text-white/90 text-xs sm:text-sm mt-1 line-clamp-2">{message}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-4xl sm:text-3xl font-light transition-colors flex-shrink-0 w-10 h-10 flex items-center justify-center touch-manipulation"
              aria-label="Close recommendations"
            >
              ×
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden hover:border-pink-500 transition-all active:scale-95 hover:shadow-lg hover:shadow-pink-500/20"
            >
              {/* Product Image Placeholder */}
              <div className="h-40 sm:h-48 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                <span className="text-5xl sm:text-6xl opacity-50">📦</span>
              </div>

              {/* Product Details */}
              <div className="p-4 sm:p-5">
                <h3 className="text-white font-bold text-base sm:text-lg mb-2 line-clamp-2">
                  {product.name}
                </h3>

                <p className="text-pink-400 text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
                  £{product.price.toFixed(2)}
                </p>

                {/* Specs */}
                <div className="mb-4 sm:mb-5">
                  <p className="text-slate-400 text-xs uppercase font-semibold mb-2 tracking-wide">
                    Key Features
                  </p>
                  <ul className="space-y-1.5">
                    {product.specs.slice(0, 4).map((spec, idx) => (
                      <li
                        key={idx}
                        className="text-slate-300 text-xs sm:text-sm flex items-start gap-2"
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
                  className="block w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 active:from-pink-700 active:to-purple-800 text-white font-bold text-center py-3 rounded-lg transition-all active:scale-95 hover:shadow-lg hover:shadow-pink-500/50 touch-manipulation text-sm sm:text-base"
                >
                  View at Currys →
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 border-t border-slate-700 p-4 sm:p-6 text-center">
          <p className="text-slate-400 text-xs sm:text-sm">
            🔒 <span className="font-semibold">Ecosystem Integration:</span> Seamlessly
            transition from repair guidance to product recommendations
          </p>
          <button
            onClick={onClose}
            className="mt-3 sm:mt-4 px-5 sm:px-6 py-2.5 sm:py-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white rounded-lg transition-colors touch-manipulation text-sm sm:text-base"
          >
            Continue with Repair
          </button>
        </div>
      </div>
    </div>
  );
}
