import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, G, Path, Pattern, Rect } from 'react-native-svg';

/** Eight-pointed star tile (two overlapping squares), repeated across the whole area. Pure vector, no image files. */
export function StarPattern({ color = '#FFFFFF', opacity = 0.12, size = 46, stroke = 1 }: { color?: string; opacity?: number; size?: number; stroke?: number }) {
  const c = size / 2;
  const r = size * 0.34;
  const sq = (rot: number) => {
    const pts = [0, 1, 2, 3].map((i) => {
      const a = ((rot + i * 90) * Math.PI) / 180;
      return `${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`;
    });
    return `M${pts.join('L')}Z`;
  };
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <Pattern id="star" width={size} height={size} patternUnits="userSpaceOnUse">
          <G fill="none" stroke={color} strokeWidth={stroke} opacity={opacity}>
            <Path d={sq(45)} />
            <Path d={sq(0)} />
            <Path d={`M0,${c}H${size}M${c},0V${size}`} opacity={0.4} />
          </G>
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#star)" />
    </Svg>
  );
}
