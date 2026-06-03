#ifndef READING_H
#define READING_H

#include <Arduino.h>

struct Reading {
  uint32_t seq;
  uint32_t tMs;
  uint8_t code;
  float voltage;
  float lux;
};

#endif
