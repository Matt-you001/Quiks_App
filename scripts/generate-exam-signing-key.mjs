import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privatePem = privateKey.export({ format: "pem", type: "pkcs8" });
const publicDer = publicKey.export({ format: "der", type: "spki" });
const rawPublicKey = Buffer.from(publicDer).subarray(-32).toString("base64");

console.log("Generate this only once for the Quiks production environment. Store the private value only in the backend secret environment.");
console.log();
console.log(`QUIKS_EXAM_PACKAGE_SIGNING_PRIVATE_KEY=base64:${Buffer.from(privatePem).toString("base64")}`);
console.log(`EXPO_PUBLIC_QUIKS_EXAM_SIGNING_PUBLIC_KEY=${rawPublicKey}`);
console.log(`QUIKS_EXAM_SIGNING_PUBLIC_KEY=${rawPublicKey}`);
console.log();
console.log("Do not commit the private key or distribute it to schools. The two public-key values are safe to embed in Quiks builds and Exam Hub installations.");
