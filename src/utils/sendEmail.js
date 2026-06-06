import nodemailer
from 'nodemailer'

const sendEmail = async (
  to,
  subject,
  text
) => {

  try {

    console.log(
      process.env.EMAIL_USER
    )

    console.log(
      process.env.EMAIL_PASS
    )

    const transporter =
      nodemailer.createTransport({

        host: 'smtp.gmail.com',

        port: 587,

        secure: false,

        auth: {
          user:
            process.env.EMAIL_USER,

          pass:
            process.env.EMAIL_PASS,
        },
      })

    await transporter.sendMail({

      from:
        process.env.EMAIL_USER,

      to,

      subject,

      html: `
        <div style="
          background:#111b21;
          padding:40px;
          font-family:Arial;
          color:white;
          text-align:center;
        ">

          <div style="
            max-width:500px;
            margin:auto;
            background:#202c33;
            border-radius:16px;
            padding:40px;
          ">

            <h1 style="
              color:#25D366;
            ">
              WhatsApp Clone
            </h1>

            <p style="
              color:#cbd5e1;
            ">
              Your OTP Code
            </p>

            <div style="
              font-size:42px;
              font-weight:bold;
              letter-spacing:10px;
              color:#25D366;
              margin:30px 0;
            ">
              ${text}
            </div>

            <p style="
              color:#94a3b8;
            ">
              OTP expires in 2 minutes
            </p>

          </div>

        </div>
      `,
    })

    console.log(
      'Email Sent Successfully'
    )

  } catch (error) {

    console.log(
      'EMAIL ERROR:',
      error
    )

    throw error
  }
}

export default sendEmail