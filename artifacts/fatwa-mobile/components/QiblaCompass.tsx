import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 22;

export function QiblaCompass({
  heading,
  qibla,
  aligned,
  kaabaDistanceKm,
}: {
  heading: number;
  qibla: number;
  aligned: boolean;
  kaabaDistanceKm: number;
}) {
  const colors = useColors();
  const ringColor = aligned ? colors.primary : colors.borderStrong;

  // The dial rotates opposite to the device heading so north stays true.
  const dialRotation = -heading;
  const needleRotation = qibla - heading;
  const offset = ((((qibla - heading) % 360) + 540) % 360) - 180;

  const ticks = Array.from({ length: 72 }, (_, index) => index * 5);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.halo,
          { borderColor: aligned ? colors.primary : colors.border, backgroundColor: colors.card },
        ]}
      >
        <Svg width={SIZE} height={SIZE}>
          <G origin={`${CENTER}, ${CENTER}`} rotation={dialRotation}>
            <Circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke={ringColor} strokeWidth={2} />
            {ticks.map((tick) => {
              const major = tick % 45 === 0;
              const angle = (tick - 90) * (Math.PI / 180);
              const inner = RADIUS - (major ? 16 : 9);
              return (
                <Line
                  key={tick}
                  x1={CENTER + Math.cos(angle) * inner}
                  y1={CENTER + Math.sin(angle) * inner}
                  x2={CENTER + Math.cos(angle) * RADIUS}
                  y2={CENTER + Math.sin(angle) * RADIUS}
                  stroke={major ? colors.foreground : colors.borderStrong}
                  strokeWidth={major ? 2 : 1}
                />
              );
            })}
            {[
              { label: 'N', angle: 0, color: colors.destructive },
              { label: 'E', angle: 90, color: colors.mutedForeground },
              { label: 'S', angle: 180, color: colors.mutedForeground },
              { label: 'W', angle: 270, color: colors.mutedForeground },
            ].map((point) => {
              const angle = (point.angle - 90) * (Math.PI / 180);
              return (
                <SvgText
                  key={point.label}
                  x={CENTER + Math.cos(angle) * (RADIUS - 30)}
                  y={CENTER + Math.sin(angle) * (RADIUS - 30) + 5}
                  fill={point.color}
                  fontSize={15}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {point.label}
                </SvgText>
              );
            })}
          </G>

          <G origin={`${CENTER}, ${CENTER}`} rotation={needleRotation}>
            <Path
              d={`M ${CENTER} ${CENTER - 96} L ${CENTER - 11} ${CENTER + 6} L ${CENTER + 11} ${CENTER + 6} Z`}
              fill={aligned ? colors.primary : colors.gold}
            />
            <Path
              d={`M ${CENTER} ${CENTER + 74} L ${CENTER - 9} ${CENTER - 4} L ${CENTER + 9} ${CENTER - 4} Z`}
              fill={colors.borderStrong}
            />
            <Circle cx={CENTER} cy={CENTER} r={26} fill={colors.card} stroke={ringColor} strokeWidth={2} />
          </G>

          <G>
            <Rect x={CENTER - 13} y={CENTER - 13} width={26} height={26} rx={3} fill="#141414" />
            <Rect x={CENTER - 13} y={CENTER - 5} width={26} height={5} fill={colors.gold} />
            <Path
              d={`M ${CENTER} ${CENTER - 96} L ${CENTER - 5} ${CENTER - 20} L ${CENTER + 5} ${CENTER - 20} Z`}
              fill={aligned ? colors.primary : colors.gold}
              opacity={aligned ? 1 : 0.9}
            />
          </G>
        </Svg>
      </View>

      <View style={styles.readout}>
        <Text style={[styles.readoutValue, { color: aligned ? colors.primary : colors.foreground }]}>
          {Math.round(qibla)}°
        </Text>
        <Text style={[styles.readoutLabel, { color: colors.mutedForeground }]}>
          {aligned ? 'Facing the Qibla' : `Turn ${offset > 0 ? 'right' : 'left'} ${Math.abs(Math.round(offset))}°`}
        </Text>
        <Text style={[styles.distance, { color: colors.mutedForeground }]}>
          {kaabaDistanceKm.toLocaleString()} km to Makkah
        </Text>
      </View>
    </View>
  );
}

/** Places the Kaaba marker at the centre of the compass dial. */

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  halo: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readout: { alignItems: 'center', marginTop: 18 },
  readoutValue: { fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  readoutLabel: { fontSize: 13, fontWeight: '600', marginTop: 5 },
  distance: { fontSize: 11.5, marginTop: 6 },
});
