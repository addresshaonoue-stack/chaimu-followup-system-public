const express = require("express");
const bcrypt = require("bcryptjs");
const { get } = require("../db");
const { currentUser } = require("../middleware");

const router = express.Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "请输入用户名和密码" });
  }

  const user = get(
    "SELECT id, username, password_hash, role, display_name, department, is_active FROM users WHERE username = ?",
    [String(username).trim()]
  );

  if (!user || !user.is_active || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: "用户名或密码错误" });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    display_name: user.display_name
  };

  return res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      display_name: user.display_name,
      department: user.department
    }
  });
});

router.get("/me", (req, res) => {
  const user = currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "未登录" });
  }
  return res.json({ user });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("chaimu.sid");
    res.json({ ok: true });
  });
});

module.exports = router;

