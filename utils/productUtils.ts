import { PieceDetail, ProductPieceDetails } from '../src/services/productService';

export interface Product {
  id: string;
  seller_id: string;
  title: string;
  category: 'women_wear' | 'men_wear' | 'kids_wear' | 'jewelry' | 'swami_sets' | 'special_occasion' | 'other';
  subcategory?: string;
  description?: string;
  images: string[];
  rental_price_per_day: number;
  security_deposit_percentage: number;
  size?: string;
  availability_status?: 'available' | 'unavailable' | 'booked';
  try_on_available?: boolean;
  try_on_location?: any;
  is_featured?: boolean;
  is_visible?: boolean;
  color?: string;
  secondary_color?: string;
  material?: string;
  tags?: string[];
  occasion_tags?: string[];
  condition?: string;
  weight?: number;
  care_instructions?: string;
  min_rental_days?: number;
  max_rental_days?: number;
  chest_size?: string;
  waist_size?: string;
  hip_size?: string;
  length?: string;
  is_multi_piece: boolean;
  piece_details: ProductPieceDetails | null;
  is_alteration_available?: boolean; // ADD THIS LINE
  created_at?: string;
  updated_at?: string;
}

export function hasMultiplePieces(product: Product): boolean {
  return product.is_multi_piece &&
         product.piece_details !== null &&
         product.piece_details.pieces !== undefined &&
         product.piece_details.pieces.length > 0;
}

export function getPieceSummary(product: Product): string {
  if (!hasMultiplePieces(product)) {
    return `Size: ${product.size || 'N/A'}`;
  }

  if (!product.piece_details || !product.piece_details.pieces) {
    return `Size: ${product.size || 'N/A'}`;
  }

  return product.piece_details.pieces
    .map(piece => `${piece.label}: ${piece.size}`)
    .join(', ');
}

export function validatePieceDetails(
  pieceDetails: ProductPieceDetails
): boolean {
  return (
    pieceDetails?.pieces?.length > 0 &&
    pieceDetails.pieces.every(
      piece => piece.type && piece.label && piece.size
    )
  );
}

export function getPrimaryPiece(product: Product): PieceDetail | null {
  if (!hasMultiplePieces(product) || !product.piece_details || !product.piece_details.pieces) {
    return null;
  }

  return product.piece_details.pieces[0] || null;
}

export function getAllPieceSizes(product: Product): string[] {
  if (!hasMultiplePieces(product) || !product.piece_details || !product.piece_details.pieces) {
    return product.size ? [product.size] : [];
  }

  return product.piece_details.pieces.map(piece => piece.size);
}

export function getPieceByType(product: Product, type: string): PieceDetail | null {
  if (!hasMultiplePieces(product) || !product.piece_details || !product.piece_details.pieces) {
    return null;
  }

  return product.piece_details.pieces.find(piece => piece.type === type) || null;
}

export function getTotalPieces(product: Product): number {
  if (!hasMultiplePieces(product) || !product.piece_details || !product.piece_details.pieces) {
    return 1; // Single piece product
  }

  return product.piece_details.pieces.length;
}

export function isValidMultiPieceProduct(product: Product): boolean {
  if (!product.is_multi_piece) {
    return true; // Single piece products are always valid
  }

  return validatePieceDetails(product.piece_details!);
}

export function formatPieceDetailsForDisplay(product: Product): string {
  if (!hasMultiplePieces(product)) {
    return product.size ? `Size: ${product.size}` : 'Size: One Size';
  }

  if (!product.piece_details || !product.piece_details.pieces) {
    return 'Size: One Size';
  }

  const pieces = product.piece_details.pieces
    .map(piece => `${piece.label} (${piece.size})`)
    .join(', ');

  return `Multi-piece: ${pieces}`;
}

export function getAvailableSizes(product: Product): string[] {
  if (!hasMultiplePieces(product)) {
    return product.size ? [product.size] : ['One Size'];
  }

  if (!product.piece_details || !product.piece_details.pieces) {
    return ['One Size'];
  }

  return [...new Set(product.piece_details.pieces.map(piece => piece.size))];
}