import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = (process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const displayName = (process.env.ADMIN_DISPLAY_NAME ?? "").trim();

  if (!username || !/^[a-z0-9_.-]{3,32}$/.test(username)) {
    throw new Error(
      "ADMIN_USERNAME must be 3-32 chars, [a-z0-9_.-]. Set it in .env."
    );
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 chars. Set it in .env.");
  }
  if (!displayName) {
    throw new Error("ADMIN_DISPLAY_NAME must be non-empty. Set it in .env.");
  }

  const password_hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      display_name: displayName,
      role: "admin",
      active: true,
    },
    create: {
      username,
      password_hash,
      display_name: displayName,
      role: "admin",
      active: true,
    },
  });

  console.log(`Seeded admin user: ${user.username} (id=${user.id})`);
  console.log(
    "IMPORTANT: change this password from /admin/users after first login."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
