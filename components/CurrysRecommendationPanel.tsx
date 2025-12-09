'use client';

/**
 * FIX IT - Currys Product Recommendation Panel
 * Minimal glass design with black theme
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/60 backdrop-blur-xl overflow-y-auto">
      <div className="w-full max-w-6xl my-auto bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/5 sticky top-0 z-10 backdrop-blur-2xl bg-black/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-3xl sm:text-4xl flex-shrink-0 opacity-60">🛒</span>
              <div className="min-w-0">
                <h2 className="text-white text-lg sm:text-2xl font-light line-clamp-1">
                  Currys Product Recommendations
                </h2>
                <p className="text-white/50 text-xs sm:text-sm mt-1 line-clamp-2 font-light">{message}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white text-3xl font-extralight transition-colors flex-shrink-0 w-10 h-10 flex items-center justify-center touch-manipulation"
              aria-label="Close recommendations"
            >
              ×
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all active:scale-[0.98]"
            >
              {/* Product Image Placeholder */}
              <div className="h-40 sm:h-48 bg-black/20 flex items-center justify-center border-b border-white/5">
                <span className="text-5xl sm:text-6xl opacity-30">📦</span>
              </div>

              {/* Product Details */}
              <div className="p-4">
                <h3 className="text-white text-base sm:text-lg font-light mb-2 line-clamp-2">
                  {product.name}
                </h3>

                <p className="text-white text-xl sm:text-2xl font-extralight mb-3">
                  £{product.price.toFixed(2)}
                </p>

                {/* Key Specs */}
                <div className="mb-4">
                  <p className="text-white/30 text-xs uppercase font-light tracking-widest mb-2">
                    Key Features
                  </p>
                  <ul className="space-y-1.5">
                    {product.specs.slice(0, 4).map((spec, idx) => (
                      <li
                        key={idx}
                        className="text-white/50 text-xs sm:text-sm font-light flex items-start gap-2"
                      >
                        <span className="text-white/20 text-xs mt-0.5">•</span>
                        <span className="flex-1 line-clamp-1">{spec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <a
                  href={product.currysUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-white/15 hover:bg-white/20 backdrop-blur-sm text-white font-light text-center py-3 rounded-xl transition-all active:scale-95 touch-manipulation text-sm sm:text-base"
                >
                  View at Currys →
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 p-4 sm:p-6 text-center backdrop-blur-sm">
          <button
            onClick={onClose}
            className="px-5 sm:px-6 py-2.5 bg-white/10 hover:bg-white/15 backdrop-blur-sm text-white/60 hover:text-white rounded-xl transition-all touch-manipulation text-sm font-light"
          >
            Continue with Repair
          </button>
        </div>
      </div>
    </div>
  );
}
