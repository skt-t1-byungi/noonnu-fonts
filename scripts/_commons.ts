import os from 'node:os'
import { defaultIfEmpty, lastValueFrom, Observable } from 'rxjs'

export const CPUS_LEN = os.cpus().length

export function log(...args: any[]) {
    console.log(new Date().toISOString(), ...args)
}

export const finished = <T>(ob: Observable<T>) => lastValueFrom(ob.pipe(defaultIfEmpty(undefined)))
