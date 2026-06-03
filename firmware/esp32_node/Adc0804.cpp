#include "Adc0804.h"
#include "config.h"

void Adc0804::begin() {
  pinMode(WR_PIN, OUTPUT);
  pinMode(RD_PIN, OUTPUT);
  pinMode(INTR_PIN, INPUT);
  for (int i = 0; i < 8; i++) pinMode(DB_PINS[i], INPUT);
  digitalWrite(WR_PIN, HIGH);
  digitalWrite(RD_PIN, HIGH);
}

uint8_t Adc0804::read() {
  digitalWrite(WR_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(WR_PIN, HIGH);

  uint32_t start = micros();
  while (digitalRead(INTR_PIN) == HIGH) {
    if (micros() - start > 500) break;
  }

  digitalWrite(RD_PIN, LOW);
  delayMicroseconds(2);
  uint8_t value = 0;
  for (int i = 0; i < 8; i++) {
    if (digitalRead(DB_PINS[i])) value |= (1 << i);
  }
  digitalWrite(RD_PIN, HIGH);
  return value;
}
