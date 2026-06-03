#ifndef NET_H
#define NET_H

#include <Arduino.h>
#include "Reading.h"

void netBegin();
void netLoop();
void netSend(const Reading &r);

#endif
