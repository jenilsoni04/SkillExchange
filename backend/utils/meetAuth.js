const jwt = require("jsonwebtoken");

const meetAuth = (userId, userName, roomName, userEmail) => {

  console.log("meetAuth called with:", userId, userName, roomName, userEmail);
  const payload = {
    context: {
      user: {
        name: userName,
        email: userEmail,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}`,
        moderator: true,  // Make the user a moderator
      },
    },
    aud: "jitsi",  // Required for Jitsi authentication
    iss: "chat",
    sub: "meet.jit.si",
    room: roomName,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1-hour expiry
  };

  return jwt.sign(payload, process.env.JITSI_SECRET, { algorithm: "HS256" });
};

module.exports = meetAuth;

// const meetAuth = (roomName) => {
//   return `https://meet.jit.si/${roomName}`;
// };

// module.exports = meetAuth;
