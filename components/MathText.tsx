import { Fragment, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

type MathToken =
  | { kind: "text"; value: string }
  | { kind: "fraction"; numerator: string; denominator: string };

const latexFractionPattern = /(?:\\+\(\s*|\$\s*)?\\+frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}(?:\s*\\+\)|\s*\$)?/g;
const plainFractionPattern = /(^|[\s(=+\-×÷,:;])(-?\d+)\s*\/\s*(-?\d+)(?=$|[\s).,;!?=+\-×÷])/g;

function appendPlainTextTokens(tokens: MathToken[], value: string) {
  let cursor = 0;
  plainFractionPattern.lastIndex = 0;

  for (const match of value.matchAll(plainFractionPattern)) {
    const matchIndex = match.index ?? 0;
    const leadingText = match[1] ?? "";
    const textBeforeFraction = value.slice(cursor, matchIndex) + leadingText;
    if (textBeforeFraction) {
      tokens.push({ kind: "text", value: textBeforeFraction });
    }
    tokens.push({ kind: "fraction", numerator: match[2], denominator: match[3] });
    cursor = matchIndex + match[0].length;
  }

  const remainder = value.slice(cursor);
  if (remainder) {
    tokens.push({ kind: "text", value: remainder });
  }
}

export function parseMathText(value: string): MathToken[] {
  const tokens: MathToken[] = [];
  let cursor = 0;
  latexFractionPattern.lastIndex = 0;

  for (const match of value.matchAll(latexFractionPattern)) {
    const matchIndex = match.index ?? 0;
    appendPlainTextTokens(tokens, value.slice(cursor, matchIndex));
    tokens.push({
      kind: "fraction",
      numerator: match[1].trim(),
      denominator: match[2].trim(),
    });
    cursor = matchIndex + match[0].length;
  }

  appendPlainTextTokens(tokens, value.slice(cursor));
  return tokens.length > 0 ? tokens : [{ kind: "text", value }];
}

export function MathText({
  value,
  textStyle,
  containerStyle,
}: {
  value?: string | null;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const resolvedValue = value ?? "";
  const tokens = useMemo(() => parseMathText(resolvedValue), [resolvedValue]);
  const flattenedTextStyle = StyleSheet.flatten(textStyle) ?? {};
  const baseFontSize = typeof flattenedTextStyle.fontSize === "number" ? flattenedTextStyle.fontSize : 16;
  const fractionFontSize = Math.max(11, Math.round(baseFontSize * 0.68));
  const fractionColor = flattenedTextStyle.color;

  return (
    <View
      accessible
      accessibilityLabel={resolvedValue}
      style={[styles.container, containerStyle]}
    >
      {tokens.map((token, index) => (
        <Fragment key={`${token.kind}-${index}`}>
          {token.kind === "text" ? (
            <Text style={textStyle}>{token.value}</Text>
          ) : (
            <View style={styles.fraction}>
              <Text
                style={[
                  styles.fractionPart,
                  styles.numerator,
                  {
                    color: fractionColor,
                    borderBottomColor: fractionColor,
                    fontSize: fractionFontSize,
                    lineHeight: fractionFontSize + 3,
                  },
                ]}
              >
                {token.numerator}
              </Text>
              <Text
                style={[
                  styles.fractionPart,
                  { color: fractionColor, fontSize: fractionFontSize, lineHeight: fractionFontSize + 3 },
                ]}
              >
                {token.denominator}
              </Text>
            </View>
          )}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  fraction: {
    minWidth: 22,
    marginHorizontal: 3,
    alignItems: "stretch",
    justifyContent: "center",
  },
  fractionPart: {
    textAlign: "center",
    paddingHorizontal: 3,
  },
  numerator: {
    borderBottomWidth: 1.5,
  },
});
