#ifndef ADC0804_H
#define ADC0804_H

#include <Arduino.h>

class Adc0804 {
 public:
  void begin();
  uint8_t read();
};

#endif
