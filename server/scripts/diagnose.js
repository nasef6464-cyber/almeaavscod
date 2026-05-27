console.log("=== DIAGNOSE ===");
console.log("Node:", process.version);
console.log("Arch:", process.arch);
console.log("Platform:", process.platform);
console.log("CWD:", process.cwd());
console.log("DIR:", require("fs").readdirSync(".").join(", "));
console.log("=== END ===");
