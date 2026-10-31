import { useState } from "react";
import { sanitizeImageUrl } from "../utils/security";

function SkincareImage({ name = "", category = "", image = "", className = "" }) {
  const [imageError, setImageError] = useState(false);
  const safeImage = sanitizeImageUrl(image);

  // Determine bottle silhouette by category/name
  const isJar =
    name.toLowerCase().includes("mask") ||
    name.toLowerCase().includes("softening") ||
    category.toLowerCase().includes("mask");

  const isDropper =
    name.toLowerCase().includes("serum") ||
    name.toLowerCase().includes("oil");

  if (safeImage && !imageError) {
    return (
      <div className={`skincare-img-wrapper ${className}`}>
        <img
          src={safeImage}
          alt={name}
          className="skincare-img-tag"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // Pure SVG Amber Glass Rendering matching the SOLE template
  return (
    <div className={`skincare-img-wrapper ${className}`}>
      {isJar ? (
        // Amber Jar with Black Cap & SOLE minimalist label
        <svg
          viewBox="0 0 160 160"
          className="skincare-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="amberJar" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4A2612" />
              <stop offset="35%" stopColor="#7B431D" />
              <stop offset="60%" stopColor="#9C5929" />
              <stop offset="85%" stopColor="#5E3116" />
              <stop offset="100%" stopColor="#3B1C0B" />
            </linearGradient>
            <linearGradient id="lidGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1E1E1E" />
              <stop offset="50%" stopColor="#3A3A3A" />
              <stop offset="100%" stopColor="#111111" />
            </linearGradient>
            <radialGradient id="jarGlow" cx="45%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#C97A3E" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#2A1409" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Jar Base */}
          <rect
            x="32"
            y="62"
            width="96"
            height="74"
            rx="8"
            fill="url(#amberJar)"
          />
          <rect
            x="32"
            y="62"
            width="96"
            height="74"
            rx="8"
            fill="url(#jarGlow)"
          />

          {/* Black Lid */}
          <rect
            x="36"
            y="44"
            width="88"
            height="20"
            rx="3"
            fill="url(#lidGrad)"
          />
          <line
            x1="36"
            y1="56"
            x2="124"
            y2="56"
            stroke="#555"
            strokeWidth="0.8"
          />

          {/* Minimalist White Label */}
          <rect
            x="48"
            y="80"
            width="64"
            height="38"
            rx="2"
            fill="#FFFFFF"
            fillOpacity="0.95"
          />
          <text
            x="80"
            y="98"
            textAnchor="middle"
            fill="#111"
            fontFamily="Georgia, serif"
            fontSize="10"
            fontWeight="bold"
            letterSpacing="2"
          >
            SOLE
          </text>
          <text
            x="80"
            y="108"
            textAnchor="middle"
            fill="#444"
            fontFamily="Arial, sans-serif"
            fontSize="5.5"
            letterSpacing="0.5"
          >
            Vitamin Cream
          </text>
        </svg>
      ) : isDropper ? (
        // Amber Dropper Bottle with SOLE label
        <svg
          viewBox="0 0 160 160"
          className="skincare-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="amberDropper" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3F1F0E" />
              <stop offset="40%" stopColor="#7D431C" />
              <stop offset="65%" stopColor="#A25D2B" />
              <stop offset="90%" stopColor="#552B13" />
              <stop offset="100%" stopColor="#2E1408" />
            </linearGradient>
            <linearGradient id="dropperLid" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1A1A1A" />
              <stop offset="50%" stopColor="#3E3E3E" />
              <stop offset="100%" stopColor="#111111" />
            </linearGradient>
          </defs>

          {/* Rubber Bulb Top */}
          <path
            d="M 72 16 Q 80 12 88 16 L 88 28 L 72 28 Z"
            fill="#1A1A1A"
          />
          {/* Collar */}
          <rect x="68" y="28" width="24" height="18" rx="2" fill="url(#dropperLid)" />

          {/* Bottle Shoulder & Body */}
          <path
            d="M 68 46 Q 50 56 48 76 L 48 138 Q 48 144 54 144 L 106 144 Q 112 144 112 138 L 112 76 Q 110 56 92 46 Z"
            fill="url(#amberDropper)"
          />

          {/* White Label */}
          <rect
            x="58"
            y="76"
            width="44"
            height="48"
            rx="2"
            fill="#FFFFFF"
            fillOpacity="0.94"
          />
          <text
            x="80"
            y="96"
            textAnchor="middle"
            fill="#111"
            fontFamily="Georgia, serif"
            fontSize="9"
            fontWeight="bold"
            letterSpacing="2"
          >
            SOLE
          </text>
          <text
            x="80"
            y="106"
            textAnchor="middle"
            fill="#555"
            fontFamily="Arial, sans-serif"
            fontSize="4.8"
            letterSpacing="0.4"
          >
            Serum
          </text>
        </svg>
      ) : (
        // Amber Pump Bottle (Moisture Repair Cream)
        <svg
          viewBox="0 0 160 160"
          className="skincare-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="amberPump" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3C1C0C" />
              <stop offset="35%" stopColor="#7E431B" />
              <stop offset="65%" stopColor="#A45E2A" />
              <stop offset="90%" stopColor="#532911" />
              <stop offset="100%" stopColor="#2A1206" />
            </linearGradient>
            <linearGradient id="pumpBlack" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#222" />
              <stop offset="50%" stopColor="#444" />
              <stop offset="100%" stopColor="#111" />
            </linearGradient>
          </defs>

          {/* Pump Spout */}
          <path
            d="M 80 18 L 98 18 Q 102 18 100 24 L 92 26 L 80 26 Z"
            fill="#1A1A1A"
          />
          <rect x="76" y="22" width="8" height="12" fill="#2E2E2E" />
          {/* Pump Collar */}
          <rect x="66" y="34" width="28" height="16" rx="2" fill="url(#pumpBlack)" />

          {/* Bottle Body */}
          <rect
            x="48"
            y="50"
            width="64"
            height="94"
            rx="7"
            fill="url(#amberPump)"
          />

          {/* Minimalist White Label */}
          <rect
            x="58"
            y="74"
            width="44"
            height="50"
            rx="2"
            fill="#FFFFFF"
            fillOpacity="0.94"
          />
          <text
            x="80"
            y="94"
            textAnchor="middle"
            fill="#111"
            fontFamily="Georgia, serif"
            fontSize="9"
            fontWeight="bold"
            letterSpacing="2"
          >
            SOLE
          </text>
          <text
            x="80"
            y="104"
            textAnchor="middle"
            fill="#555"
            fontFamily="Arial, sans-serif"
            fontSize="4.5"
            letterSpacing="0.4"
          >
            Moisture Repair
          </text>
        </svg>
      )}
    </div>
  );
}

export default SkincareImage;

