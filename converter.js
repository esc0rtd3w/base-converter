#!/usr/bin/env node
const ESC = '\u001b'
const CSI = `${ESC}[`

let inputDigits = '0123456789'
let input = ''
let outputDigits = '0123456789abcdef'
let output = ''
let cursorPos = [0, 0]

let labels = [
  'Input Base Digits: ',
  'Input Number: ',
  'Output Base Digits: ',
  'Output: '
]

let warn = '31m'
let highlightDups = s => {
  let chars = ['.'] // don't allow .
  let out = ''
  for (let i of s) {
    if (chars.includes(i)) out += `${CSI}${warn}${i}${CSI}0m`
    else {
      chars.push(i)
      out += i
    }
  }
  return out
}
let highlightNum = (s, valid) => {
  let out = ''
  let points = 0
  for (let i of s) {
    if (valid.includes(i)) out += i
    else if (i === '.') {
      points++
      if (points > 1) out += `${CSI}${warn}${i}${CSI}0m`
      else out += '.'
    } else out += `${CSI}${warn}${i}${CSI}0m`
  }
  return out
}

let draw = function () {
  process.stdout.write(`${CSI}2J`)
  process.stdout.write(`${CSI}1;1H`)
  process.stdout.write(`${CSI}38;5;246m${labels[0]}${CSI}0m${highlightDups(inputDigits)}\n`)
  process.stdout.write(`${CSI}38;5;246m${labels[1]}${CSI}0m${highlightNum(input, inputDigits)}\n`)
  process.stdout.write(`${CSI}38;5;246m${labels[2]}${CSI}0m${highlightDups(outputDigits)}\n`)
  process.stdout.write(`${CSI}38;5;246m${labels[3]}${CSI}0m${highlightNum(output, outputDigits)}`)

  let cursorX = labels[cursorPos[1]].length + cursorPos[0]
  let cursorY = cursorPos[1]
  process.stdout.write(`${CSI}${cursorY + 1};${cursorX + 1}H`)
}

process.stdin.setRawMode(true)
process.stdin.resume()

let getCurrentInput = function () {
  switch (cursorPos[1]) {
    case 0:
      return inputDigits
    case 1:
      return input
    case 2:
      return outputDigits
    case 3:
      return output
    default:
      return ''
  }
}
let setCurrentInput = function (data) {
  switch (cursorPos[1]) {
    case 0:
      inputDigits = data
      return inputDigits
    case 1:
      input = data
      return input
    case 2:
      outputDigits = data
      return outputDigits
    case 3:
      output = data
      return output
    default:
      return ''
  }
}

let removeDups = function (input) {
  let chars = input.split('')
  let output = ''
  for (let i of chars) {
    if (!output.includes(i)) output += i
  }
  return output
}

let fromBase = function (value, digits) {
  let result = 0
  let radix = digits.length
  let idigits = value.replace(/\./g, '').split('').reverse()
  let expPos = 0
  if (value.includes('.')) expPos = 1 - value.length + value.indexOf('.')
  let expPosCounter = expPos
  for (let i of idigits) {
    let val = digits.indexOf(i)
    if (val === -1) continue
    result += Math.pow(radix, expPosCounter++) * val
  }
  return [result, expPos]
}
let toBase = function (value, digits, expPos) {
  let result = ''
  let radix = digits.length
  let digitCount = Math.floor(Math.log(value) / Math.log(radix)) - expPos
  let di = digitCount
  let iterations = 0
  if (value < 1) result += '.'
  while (value !== 0) {
    let rad = Math.pow(radix, di + expPos)
    let digit = Math.floor(value / rad)
    value %= rad
    result += digits[digit]
    if (di + expPos === 0 && value !== 0) result += '.'
    di--
    iterations++
    if (iterations > 1000) value = 0
  }
  if (digitCount >= result.length) {
    result += '0'.repeat(1 - result.length + digitCount)
  }
  return result
}

let doRemoveDups = false
let update = function () {
  if (doRemoveDups) {
    inputDigits = removeDups(inputDigits)
    outputDigits = removeDups(outputDigits)
    cursorPos[0] = Math.min(getCurrentInput().length, cursorPos[0])
  }

  if (inputDigits.length < 2 || outputDigits.length < 2) return

  if (cursorPos[1] <= 2) {
    let [inputValue, expPos] = fromBase(input, inputDigits)
    output = toBase(inputValue, outputDigits, expPos)
  } else {
    let [outputValue, expPos] = fromBase(output, outputDigits)
    input = toBase(outputValue, inputDigits, expPos)
  }
}

let baseTemplate = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
let base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

process.stdin.on('data', chunk => {
  chunk = chunk.toString()
  if (chunk === '\u0003') {
    process.stdout.write(`${CSI}5;1H`)
    process.exit(-1)
  } else if (chunk === '\u001b[A') {
    // up
    cursorPos[1] = (((cursorPos[1] - 1) % labels.length) + labels.length) %
      labels.length
    cursorPos[0] = getCurrentInput().length
  } else if (chunk === '\u001b[B') {
    // down
    cursorPos[1] = (cursorPos[1] + 1) % labels.length
    cursorPos[0] = getCurrentInput().length
  } else if (chunk === '\u001b[D') {
    // left
    cursorPos[0] = Math.max(0, cursorPos[0] - 1)
  } else if (chunk === '\u001b[C') {
    // right
    cursorPos[0] = Math.min(getCurrentInput().length, cursorPos[0] + 1)
  } else if (chunk === '\u007f') {
    let input = getCurrentInput()
    input = input.substr(0, cursorPos[0] - 1) + input.substr(cursorPos[0])
    setCurrentInput(input)
    cursorPos[0] = Math.max(0, cursorPos[0] - 1)
  } else if (chunk === '\u001b[1;5A') {
    // ctrl up
    if (cursorPos[1] === 1 || cursorPos[1] === 3) {
      let digits = cursorPos[1] === 1 ? inputDigits : outputDigits
      let [value, expPos] = fromBase(getCurrentInput(), digits)
      setCurrentInput(toBase(value + 1, digits, expPos))
    } else {
      let base = getCurrentInput()
      if (baseTemplate.startsWith(base)) {
        if (base.length < baseTemplate.length) {
          setCurrentInput(baseTemplate.substr(0, base.length + 1))
        } else {
          setCurrentInput(base64)
        }
      }
    }
    cursorPos[0] = Math.min(getCurrentInput().length, cursorPos[0])
  } else if (chunk === '\u001b[1;5B') {
    // ctrl down
    if (cursorPos[1] === 1 || cursorPos[1] === 3) {
      let digits = cursorPos[1] === 1 ? inputDigits : outputDigits
      let [value, expPos] = fromBase(getCurrentInput(), digits)
      setCurrentInput(toBase(value - 1, digits, expPos))
    } else {
      let base = getCurrentInput()
      if (baseTemplate.startsWith(base) && base.length > 0) {
        setCurrentInput(baseTemplate.substr(0, base.length - 1))
      } else if (base === base64) {
        setCurrentInput(baseTemplate)
      }
    }
    cursorPos[0] = Math.min(getCurrentInput().length, cursorPos[0])
  } else {
    chunk = chunk.replace(/\u001b/g, '^[')
    let input = getCurrentInput()
    input = input.substr(0, cursorPos[0]) + chunk + input.substr(cursorPos[0])
    setCurrentInput(input)
    cursorPos[0] += chunk.length
  }
  update()
  draw()
})

let loop = function () {
  setTimeout(loop, 16)
}
draw()
loop()
