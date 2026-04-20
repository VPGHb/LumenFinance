import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Home from "./(tabs)/home";

// ── Twinkling star ────────────────────────────────────────────────────────────
function Star({ x, y, size, delay }) {
  const opacity = useRef(new Animated.Value(0.15)).current;
  useEffect(() => {
    const loop = () =>
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 2000 + Math.random() * 1000, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.05, duration: 2000 + Math.random() * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]).start(loop);
    loop();
  }, []);
  return (
    <Animated.View style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: size / 2, backgroundColor: "#fff", opacity }} />
  );
}

// Stars spread randomly across the entire screen
function buildStars(w, h) {
  const stars = [];
  for (let i = 0; i < 127; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 1 + Math.random() * 2.5,  // Random size between 1-3.5
      delay: Math.random() * 2000,     // Random delay up to 2 seconds
    });
  }
  return stars;
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function MainDash() {
  const { width, height } = useWindowDimensions();
  const stars = buildStars(width, height);

  return (
    <View style={s.root}>
      {/* Full-width dark sky background */}
      <View style={[s.skyBg, { width }]} />

      {/* Animated stars */}
      {stars.map((st, i) => <Star key={i} {...st} />)}

      {/* Home screen content over the star field */}
      <Home />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0f0e28",
    alignSelf: "stretch",
  },
  skyBg: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    backgroundColor: "#0f0e28",
  },
});