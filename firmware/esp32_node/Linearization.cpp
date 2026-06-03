#include "Linearization.h"
#include "config.h"
#include <math.h>

float codeToVoltage(uint8_t code) {
  return (code / 255.0f) * VFS;
}

float voltageToResistance(float v) {
  if (v < 0.001f) v = 0.001f;
  if (v > VCC - 0.001f) v = VCC - 0.001f;
  return R_FIXED * ((VCC / v) - 1.0f);
}

float resistanceToLux(float r) {
  if (r < 0.001f) r = 0.001f;
  return powf(10.0f, (log10f(r) - CAL_B) / CAL_M);
}

float codeToLux(uint8_t code) {
  return resistanceToLux(voltageToResistance(codeToVoltage(code)));
}
