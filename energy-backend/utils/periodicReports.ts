import { Sequelize } from 'sequelize';
import axios from 'axios';

import { defineModels } from '../databaseModels';
import { subMonths, subWeeks } from 'date-fns';

export const executePeriodicReports = async () => {
  const sequelize = new Sequelize(process.env.DATABASE_URI!, {
    dialect: 'postgres',
    protocol: 'postgres',
    define: { timestamps: false }, // remove created and updated timestamps from models
    dialectOptions: {},
    logging: false, // Turn off logging
  });

  const currentTime = new Date().toISOString();

  // Weekly report
  await generatePeriodicReports(
    sequelize,
    subWeeks(currentTime, 1).toISOString(),
    currentTime
  );

  // Monthly report
  await generatePeriodicReports(
    sequelize,
    subMonths(currentTime, 1).toISOString(),
    currentTime
  );
};

/**
 * Generates periodic reports for all consumers
 * @param sequelize Database connection
 * @param startTime Start time of the reports
 * @param endTime End time of the reports
 */
export const generatePeriodicReports = async (
  sequelize: Sequelize,
  startTime: string,
  endTime: string
) => {
  // Define models
  const models = defineModels(sequelize);
  const { Report, Consumer } = models;

  // Get all consumers
  const consumers = await Consumer.findAll();

  // Get the latest report ID
  const latestReport = await Report.findOne({
    order: [['id', 'DESC']],
  });

  let latestReportId = latestReport ? Number(latestReport.id) : 0;

  // Generate reports for each consumer
  await Report.bulkCreate(
    consumers.map((consumer, index) => ({
      id: latestReportId + index + 1,
      consumer_id: consumer.id,
      suburb_id: undefined,
      start_date: startTime,
      end_date: endTime,
    }))
  );

  console.log(
    `Generated periodic reports for the period ${startTime} to ${endTime} for ${consumers.length} consumers`
  );

  // Send emails to consumers
  const consumersToEmail = consumers.filter(
    (consumer) => consumer.email_address
  );
  if (consumersToEmail.length === 0) {
    console.log('No consumers to email.');
    return;
  }

  consumersToEmail.forEach(async (consumer) => {
    console.log('Sending email to ' + consumer.email_address);
    const subject =
      'Energy report for the period ' + startTime + ' to ' + endTime;
    const body = `Dear customer,\n\nPlease visit the PowerTrack dashboard to see the latest report, for the period from ${startTime} to ${endTime}.\n\nRegards,\nPowerTrack`;
    await sendEmail(consumer.email_address!, subject, body);
  });
};

/**
 * Sends an email using the SendGrid API
 * @param emailAddress Email address to send email to
 * @param subject Subject of the email
 * @param body Body of the email
 */
const sendEmail = async (
  emailAddress: string,
  subject: string,
  body: string
) => {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const fromEmailAddress = 'powertrackofficial@gmail.com';
  const fromName = 'PowerTrack';
  const url = 'https://api.sendgrid.com/v3/mail/send';

  await axios
    .post(
      url,
      {
        personalizations: [
          {
            to: [{ email: emailAddress }],
            subject: subject,
          },
        ],
        content: [
          {
            type: 'text/plain',
            value: body,
          },
        ],
        from: { email: fromEmailAddress, name: fromName },
        reply_to: { email: fromEmailAddress, name: fromName },
      },
      {
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )
    .then(() => {
      console.log('Email sent successfully to ' + emailAddress);
    })
    .catch((error) => {
      console.error('Error sending email: ', JSON.stringify(error));
    });
};

if (require.main === module) {
  // Execute the following if this file is run from the command line
  executePeriodicReports();
}
