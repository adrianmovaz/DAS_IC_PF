#ifndef LINEARIZATION_H
#define LINEARIZATION_H

#include <Arduino.h>

float codeToVoltage(uint8_t code);
float voltageToResistance(float v);
float resistanceToLux(float r);
float codeToLux(uint8_t code);

#endif
