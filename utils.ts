import * as path from "https://deno.land/std/path/mod.ts";
import { walkSync } from "https://deno.land/std/fs/mod.ts";
import { OperatingSystem } from './models/OperatingSystem.ts';
import { CacheFolder } from './models/CacheFolder.ts'

export function getOsInfo(): OperatingSystem {
    let rtnVal: OperatingSystem = {
        arch: Deno.build.arch,
        currentPath: Deno.cwd(),
        denoPath: Deno.execPath(),
        denoVersion: Deno.version.deno,
        homeDir: getDenoDir(),
        hostname: Deno.hostname(),
        os: Deno.build.os,
        typescriptVersion: Deno.version.typescript,
        v8Version: Deno.version.v8
    }

    return rtnVal;
}


enum OS {
    win, linux, mac
}

function getOS(): OS {
    return OS[Deno.build.os];
}

/**
 * Returs deno root directory
 * Example:
 * - (C:\Users\USERNAME\AppData\Local\deno) on windows
 * - (/home/USERNAME/.cache/deno) on linux
 */
export function getDenoDir(): string {
    let os = getOS();
    let homeKey: string = os == OS.win ? 'USERPROFILE' : 'HOME'
    let homeDir = Deno.env(homeKey)
    let relativeDir = "";

    switch (os) {
        case OS.win:
            relativeDir = "AppData/Local/deno"
            break;
        case OS.linux:
            relativeDir = ".cache/deno"
            break;
        case OS.mac:
            relativeDir = "Library/Caches/deno"
            break;
    }

    return path.join(homeDir, relativeDir)
}

export function getDepsCacheDir(): string {
    let homeDir = getDenoDir()
    return path.join(homeDir, 'deps/https/')
}

export function getTypeScriptCacheDirLocal(): string {
    let homeDir = getDenoDir()
    return path.join(homeDir, 'gen/file')
}

export function getTypeScriptCacheDirRemote(): string {
    let homeDir = getDenoDir()
    return path.join(homeDir, 'gen/https')
}

export function listDepsFolders(): Array<CacheFolder> {
    let rtnVal = new Array<CacheFolder>()
    let rootFolder = getDepsCacheDir()
    let folders = Deno.readDirSync(rootFolder)
    folders.forEach(folder => {
        let f: CacheFolder = {
            created: new Date(folder.created),
            name: folder.name,
            path: rootFolder,
            id: btoa(path.join(rootFolder, folder.name))
        }
        rtnVal.push(f)
    })
    return rtnVal.slice(0, 20)
}

function containsFiles(path: string): boolean {
    try {
        let items = Deno.readDirSync(path)

        for (let i = 0; i < items.length; i++) {
            if (items[i].isFile()) {
                return true;
            }
        }
        return false;

    } catch (error) {
        return false
    }
}

export function listGenFoldersLocal(): Array<CacheFolder> {
    let rtnVal = new Array<CacheFolder>()
    let rootFolder = getTypeScriptCacheDirLocal()

    for (const fileInfo of walkSync(rootFolder, { includeFiles: false, includeDirs: true })) {
        if (containsFiles(fileInfo.filename)) {
            let f: CacheFolder = {
                created: new Date(),
                name: '...' + fileInfo.filename.replace(rootFolder, ''),
                path: fileInfo.filename,
                id: btoa(fileInfo.filename)
            }
            rtnVal.push(f)
        }
    }
    let sorted = rtnVal.sort((f1, f2) => {
        if (f1.path.length > f2.path.length) {
            return 1
        }
        if (f1.path.length < f2.path.length) {
            return -1
        }
        return 0;
    })
    return sorted.slice(0, 20)
}

export function listGenFoldersRemote(): Array<CacheFolder> {
    let rtnVal = new Array<CacheFolder>()
    let rootFolder = getTypeScriptCacheDirRemote()

    let folders = Deno.readDirSync(rootFolder)
    folders.forEach(folder => {
        let f: CacheFolder = {
            created: new Date(folder.created),
            name: folder.name,
            path: rootFolder,
            id: btoa(path.join(rootFolder, folder.name))
        }
        rtnVal.push(f)
    })
    return rtnVal.slice(0, 20)
}

export async function deleteFolder(folder: string): Promise<any> {
    try {
        folder = atob(folder)
        await Deno.remove(folder, { recursive: true })
        return {
            success: true,
            error: ''
        }
    } catch (error) {
        return {
            success: false,
            error: error
        }
    }
}

export async function runDeno(command: string): Promise<string> {
    try {
        command = atob(command)
        let p = Deno.run({
            args: ["deno", "eval", command],
            stdout: "piped",
            stderr: "piped"
        })

        const { code } = await p.status();

        let res = ''
        if (code === 0) {
            const rawOutput = await p.output();
            res = new TextDecoder("utf-8").decode(rawOutput)
        } else {
            const rawError = await p.stderrOutput();
            res = new TextDecoder().decode(rawError);
        }

        return res;
    } catch (error) {
        return error.toString();
    }
}

export async function fetchDenoVersion(): Promise<string> {
    try {
        let response = await fetch('https://github.com/denoland/deno/releases/latest')
        let body = await response.text()
        const regVer = new RegExp(/title\=\"v(.*)?\"/)
        let res = regVer.exec(body)
        return res[1]
    } catch (error) {
        return 'Error fetching'
    }

}