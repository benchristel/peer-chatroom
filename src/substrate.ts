export function sleep(seconds: number) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

export function remove<T>(elem: T, array: Array<T>): void {
  const index = array.indexOf(elem)
  if (index < 0) return;
  array.splice(index, 1)
}

export function *cycleForever<T>(options: Array<T>) {
  while (true) {
    for (let option of options) {
      yield option
    }
  }
}
