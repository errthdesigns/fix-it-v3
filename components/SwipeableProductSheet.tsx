'use client';

/**
 * FIX IT - Swipeable Product Sheet
 * Minimal glass design with swipe gestures
 */

import { useState } from 'react';
import { ProductCategory } from '@/lib/types';

interface SwipeableProductSheetProps {
  category: ProductCategory;
  onClose: () => void;
}

export default function SwipeableProductSheet({
  category,
  onClose,
}: SwipeableProductSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    const deltaY = currentY - startY;

    if (deltaY < -50 && !isExpanded) {
      setIsExpanded(true);
    } else if (deltaY > 50 && isExpanded) {
      setIsExpanded(false);
    } else if (deltaY > 100 && !isExpanded) {
      onClose();
    }

    setIsDragging(false);
    setStartY(0);
    setCurrentY(0);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-xl z-40 transition-opacity duration-300 ${
          isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsExpanded(false)}
      />

      {/* Product Sheet */}
      <div
        className={`fixed left-0 right-0 bg-black/40 backdrop-blur-2xl border-t border-white/10 shadow-2xl z-50 transition-all duration-500 ease-out touch-none ${
          isExpanded
            ? 'bottom-0 top-16 sm:top-20 rounded-t-3xl'
            : 'bottom-0 rounded-t-3xl'
        }`}
        style={{
          height: isExpanded ? 'auto' : '180px',
          maxHeight: isExpanded ? 'calc(100vh - 4rem)' : '180px',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className="sticky top-0 bg-black/40 backdrop-blur-2xl z-10 pt-3 pb-3">
          <div className="flex justify-center">
            <div className="w-12 h-1 bg-white/20 rounded-full" />
          </div>

          <div className="px-5 sm:px-6 mt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-3xl opacity-60">🛒</span>
                <div className="min-w-0">
                  <p className="text-white/40 text-xs font-light uppercase tracking-wider">
                    {isExpanded ? 'Product not recognized' : 'Swipe up to shop'}
                  </p>
                  <h3 className="text-white text-lg sm:text-xl font-light line-clamp-1">
                    {category.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/40 hover:text-white text-3xl font-extralight transition-colors flex-shrink-0 w-10 h-10 flex items-center justify-center touch-manipulation"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={`px-5 sm:px-6 pb-6 overflow-y-auto ${isExpanded ? 'h-full' : 'h-24'}`}>
          {!isExpanded && (
            <div className="flex items-center justify-center gap-4 overflow-x-auto pb-2 mt-2">
              {category.products.slice(0, 3).map((product) => (
                <div
                  key={product.id}
                  className="flex-shrink-0 w-24 h-24 bg-white/5 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/10"
                >
                  <span className="text-3xl opacity-30">📦</span>
                </div>
              ))}
            </div>
          )}

          {isExpanded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {category.products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all"
                >
                  {/* Product Image */}
                  <div className="h-40 sm:h-48 bg-black/20 flex items-center justify-center border-b border-white/5">
                    <span className="text-5xl opacity-30">📦</span>
                  </div>

                  {/* Product Details */}
                  <div className="p-4">
                    <h4 className="text-white font-light text-sm sm:text-base mb-2 line-clamp-2">
                      {product.name}
                    </h4>

                    <p className="text-white text-xl sm:text-2xl font-extralight mb-3">
                      £{product.price.toFixed(2)}
                    </p>

                    {/* Rating */}
                    {product.rating && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={`text-sm ${
                                i < Math.floor(product.rating!)
                                  ? 'text-white/50'
                                  : 'text-white/10'
                              }`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        {product.reviewCount && (
                          <span className="text-white/30 text-xs font-light">
                            ({product.reviewCount})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Colors */}
                    {product.colors && product.colors.length > 0 && (
                      <div className="mb-3">
                        <p className="text-white/30 text-xs uppercase font-light tracking-widest mb-1.5">
                          Colors
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {product.colors.map((color) => (
                            <span
                              key={color}
                              className="px-2 py-1 bg-white/5 text-white/40 text-xs rounded font-light"
                            >
                              {color}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Specs */}
                    <div className="mb-3">
                      <p className="text-white/30 text-xs uppercase font-light tracking-widest mb-1.5">
                        Key Features
                      </p>
                      <ul className="space-y-1">
                        {product.specs.slice(0, 3).map((spec, idx) => (
                          <li
                            key={idx}
                            className="text-white/50 text-xs font-light flex items-start gap-1.5"
                          >
                            <span className="text-white/20 text-xs mt-0.5">•</span>
                            <span className="flex-1 line-clamp-1">{spec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Stock Status */}
                    {product.inStock !== undefined && (
                      <div className="mb-3">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-light ${
                            product.inStock
                              ? 'bg-white/10 text-white/60'
                              : 'bg-white/5 text-white/30'
                          }`}
                        >
                          {product.inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-2">
                      <a
                        href={product.currysUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-white/15 hover:bg-white/20 backdrop-blur-sm text-white font-light text-center py-2.5 rounded-xl transition-all active:scale-95 text-sm touch-manipulation"
                      >
                        View Details
                      </a>
                      <button
                        onClick={() => window.open(product.currysUrl, '_blank')}
                        className="px-4 bg-white/10 hover:bg-white/15 backdrop-blur-sm text-white/60 font-light rounded-xl transition-all active:scale-95 text-sm touch-manipulation"
                        title="Add to basket"
                      >
                        🛒
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
