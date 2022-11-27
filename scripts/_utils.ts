import os from 'node:os'

export const CPUS_LEN = os.cpus().length

export function log(...args: any[]) {
    console.log(new Date().toISOString(), ...args)
}
